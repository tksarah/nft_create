"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import { getAddress, isAddress, parseAbiItem } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { soneiumMinato } from "@/lib/chains";
import { attendanceSbtAbi, getContractAddress, getContractDeployBlock } from "@/lib/contract";

const BATCH_SIZE = 100;
const EVENT_BLOCK_STEP = 20_000n;
const SET_CLAIM_OPEN_GAS_LIMIT = 100_000n;
const ALLOWLIST_BASE_GAS_LIMIT = 80_000n;
const ALLOWLIST_GAS_LIMIT_PER_ACCOUNT = 35_000n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ALLOWLIST_SET_EVENT = parseAbiItem("event AllowlistSet(address indexed account, bool allowed)");

type ParsedAddresses = {
  valid: Address[];
  invalid: string[];
};

type AllowlistRow = {
  account: Address;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
};

export function AdminPanel() {
  const contractAddress = useMemo(() => getContractAddress(), []);
  const deployBlock = useMemo(() => getContractDeployBlock(), []);
  const readContractAddress = contractAddress ?? ZERO_ADDRESS;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: soneiumMinato.id });
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [rawAddresses, setRawAddresses] = useState("");
  const [message, setMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState<Hash>();
  const [progress, setProgress] = useState("");
  const [allowlistRows, setAllowlistRows] = useState<AllowlistRow[]>([]);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [listMessage, setListMessage] = useState("");
  const [lastListRefreshBlock, setLastListRefreshBlock] = useState<bigint>();

  const isMinato = chainId === soneiumMinato.id;
  const isConfigured = Boolean(contractAddress);
  const parsed = useMemo(() => parseAddresses(rawAddresses), [rawAddresses]);

  const owner = useReadContract({
    address: contractAddress,
    abi: attendanceSbtAbi,
    functionName: "owner",
    query: {
      enabled: isConfigured,
    },
  });

  const claimOpen = useReadContract({
    address: contractAddress,
    abi: attendanceSbtAbi,
    functionName: "claimOpen",
    query: {
      enabled: isConfigured,
    },
  });

  const statusChecks = useReadContracts({
    contracts: parsed.valid.map((account) => ({
      address: readContractAddress,
      abi: attendanceSbtAbi,
      functionName: "allowlisted",
      args: [account],
      chainId: soneiumMinato.id,
    })),
    query: {
      enabled: isConfigured && parsed.valid.length > 0,
    },
  });

  const claimedChecks = useReadContracts({
    contracts: allowlistRows.map((row) => ({
      address: readContractAddress,
      abi: attendanceSbtAbi,
      functionName: "hasClaimed",
      args: [row.account],
      chainId: soneiumMinato.id,
    })),
    query: {
      enabled: isConfigured && allowlistRows.length > 0,
    },
  });

  const isOwner =
    Boolean(address && owner.data) && address?.toLowerCase() === String(owner.data).toLowerCase();
  const canManage = isConnected && isConfigured && isMinato && isOwner && parsed.valid.length > 0;

  async function ensureMinato() {
    if (!isMinato) {
      await switchChainAsync({ chainId: soneiumMinato.id });
    }
  }

  async function setAllowlist(allowed: boolean) {
    setMessage("");
    setProgress("");
    setLastTxHash(undefined);

    if (!contractAddress || !publicClient) {
      setMessage("Contract is not configured.");
      return;
    }
    if (parsed.invalid.length > 0) {
      setMessage(`Invalid address found: ${parsed.invalid[0]}`);
      return;
    }
    if (!isOwner) {
      setMessage("Owner wallet is required.");
      return;
    }

    await ensureMinato();

    const chunks = chunkAddresses(parsed.valid, BATCH_SIZE);
    for (let index = 0; index < chunks.length; index++) {
      const accounts = chunks[index];
      setProgress(`Batch ${index + 1} / ${chunks.length}`);
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: attendanceSbtAbi,
        functionName: "setAllowlist",
        args: [accounts, allowed],
        chainId: soneiumMinato.id,
        gas: allowlistGasLimit(accounts.length),
      });
      setLastTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
    }

    setProgress("");
    setMessage(allowed ? "Allowlist added." : "Allowlist removed.");
    await statusChecks.refetch();
    await refreshAllowlist();
  }

  async function toggleClaimOpen() {
    setMessage("");
    setLastTxHash(undefined);

    if (!contractAddress || !publicClient) {
      setMessage("Contract is not configured.");
      return;
    }
    if (!isOwner) {
      setMessage("Owner wallet is required.");
      return;
    }

    await ensureMinato();

    const nextClaimOpen = !claimOpen.data;
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: attendanceSbtAbi,
      functionName: "setClaimOpen",
      args: [nextClaimOpen],
      chainId: soneiumMinato.id,
      gas: SET_CLAIM_OPEN_GAS_LIMIT,
    });
    setLastTxHash(hash);
    await publicClient.waitForTransactionReceipt({ hash });
    await claimOpen.refetch();
    setMessage(`Claim is now ${nextClaimOpen ? "open" : "closed"}.`);
  }

  async function refreshAllowlist() {
    setListMessage("");

    if (!contractAddress || !publicClient) {
      setListMessage("Contract is not configured.");
      return;
    }
    if (!deployBlock) {
      setListMessage("Set NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK to load the allowlist.");
      return;
    }

    setIsRefreshingList(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const rowsByAccount = new Map<string, AllowlistRow>();
      let eventCount = 0;

      for (let fromBlock = deployBlock; fromBlock <= latestBlock; fromBlock += EVENT_BLOCK_STEP) {
        const toBlock = minBigInt(fromBlock + EVENT_BLOCK_STEP - 1n, latestBlock);
        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: ALLOWLIST_SET_EVENT,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const account = log.args.account;
          const allowed = log.args.allowed;
          if (!account || typeof allowed !== "boolean" || !log.transactionHash) {
            continue;
          }

          eventCount++;
          const key = account.toLowerCase();
          if (allowed) {
            rowsByAccount.set(key, {
              account: getAddress(account),
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              logIndex: log.logIndex,
            });
          } else {
            rowsByAccount.delete(key);
          }
        }
      }

      const rows = Array.from(rowsByAccount.values()).sort(compareAllowlistRows);
      setAllowlistRows(rows);
      setLastListRefreshBlock(latestBlock);
      setListMessage(`Loaded ${rows.length} active address(es) from ${eventCount} event(s).`);
    } catch (error) {
      setListMessage(error instanceof Error ? error.message : "Failed to load allowlist events.");
    } finally {
      setIsRefreshingList(false);
    }
  }

  return (
    <section className="adminPanel" aria-label="Allowlist admin">
      <header className="adminHeader">
        <div>
          <p className="eyebrow">Owner Console</p>
          <h1>Allowlist Admin</h1>
        </div>
        <a className="secondaryLink" href="/">
          Mint page
        </a>
      </header>

      <div className="walletRow">
        <ConnectButton showBalance={false} chainStatus="name" accountStatus="address" />
      </div>

      <dl className="statusGrid adminStatusGrid">
        <StatusItem label="Network" value={isMinato ? "Minato" : "Switch required"} tone={isMinato ? "good" : "warn"} />
        <StatusItem label="Contract" value={isConfigured ? "Ready" : "Missing"} tone={isConfigured ? "good" : "warn"} />
        <StatusItem label="Owner" value={ownerLabel({ isConnected, isOwner })} tone={isOwner ? "good" : "warn"} />
        <StatusItem label="Claim" value={claimOpen.data ? "Open" : "Closed"} tone={claimOpen.data ? "good" : "warn"} />
      </dl>

      {isConnected && !isMinato ? (
        <button className="secondaryButton" type="button" disabled={isSwitching} onClick={() => ensureMinato()}>
          {isSwitching ? "Switching" : "Switch to Minato"}
        </button>
      ) : null}

      {isConnected && isMinato && !isOwner ? (
        <p className="adminNotice">Connect with the owner wallet.</p>
      ) : null}

      {claimOpen.data === false ? (
        <p className="adminNotice">
          Claim is closed. Eligible wallets can claim only after the Open claim transaction is confirmed.
        </p>
      ) : null}

      <div className="adminControls">
        <button
          className="secondaryButton"
          type="button"
          disabled={!isOwner || !isMinato || !isConfigured || isWriting}
          onClick={toggleClaimOpen}
        >
          {claimOpen.data ? "Close claim" : "Open claim"}
        </button>
      </div>

      <section className="allowlistList" aria-label="Registered allowlist">
        <header className="allowlistHeader">
          <div>
            <p className="eyebrow">Registered</p>
            <h2>Allowlist</h2>
          </div>
          <button
            className="secondaryButton"
            type="button"
            disabled={!isConfigured || !publicClient || !deployBlock || isRefreshingList}
            onClick={refreshAllowlist}
          >
            {isRefreshingList ? "Refreshing" : "Refresh list"}
          </button>
        </header>

        <div className="addressSummary">
          <span>{allowlistRows.length} active</span>
          <span>From block {deployBlock ? deployBlock.toString() : "missing"}</span>
          <span>Latest {lastListRefreshBlock ? lastListRefreshBlock.toString() : "-"}</span>
        </div>

        {listMessage ? <p className="listMessage">{listMessage}</p> : null}

        {allowlistRows.length > 0 ? (
          <div className="allowlistTable">
            <div className="allowlistTableHeader">
              <span>Address</span>
              <span>Claimed</span>
              <span>Updated</span>
            </div>
            {allowlistRows.map((row, index) => (
              <div key={row.account} className="allowlistTableRow">
                <a href={`${soneiumMinato.blockExplorers.default.url}/address/${row.account}`} target="_blank" rel="noreferrer">
                  {row.account}
                </a>
                <strong>{claimStatusLabel(claimedChecks.data?.[index]?.result)}</strong>
                <a href={`${soneiumMinato.blockExplorers.default.url}/tx/${row.transactionHash}`} target="_blank" rel="noreferrer">
                  {row.blockNumber.toString()}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="emptyList">No active allowlist addresses loaded.</p>
        )}
      </section>

      <label className="addressInput">
        <span>Addresses or CSV</span>
        <textarea
          value={rawAddresses}
          onChange={(event) => setRawAddresses(event.target.value)}
          placeholder="0x1234...&#10;0xabcd..."
          rows={9}
        />
      </label>

      <div className="addressSummary">
        <span>{parsed.valid.length} valid</span>
        <span>{parsed.invalid.length} invalid</span>
        <span>{Math.ceil(parsed.valid.length / BATCH_SIZE) || 0} batch</span>
      </div>

      {parsed.valid.length > 0 ? (
        <div className="addressPreview">
          {parsed.valid.slice(0, 8).map((account, index) => (
            <div key={account} className="addressRow">
              <span>{shortAddress(account)}</span>
              <strong>{statusLabel(statusChecks.data?.[index]?.result)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="adminActions">
        <button className="primaryButton" type="button" disabled={!canManage || isWriting} onClick={() => setAllowlist(true)}>
          Add to allowlist
        </button>
        <button className="dangerButton" type="button" disabled={!canManage || isWriting} onClick={() => setAllowlist(false)}>
          Remove from allowlist
        </button>
      </div>

      <div className="feedback" aria-live="polite">
        {isWriting ? <span>Confirm in wallet</span> : null}
        {progress ? <span>{progress}</span> : null}
        {message ? <span>{message}</span> : null}
        {lastTxHash ? (
          <a href={`${soneiumMinato.blockExplorers.default.url}/tx/${lastTxHash}`} target="_blank" rel="noreferrer">
            View last transaction
          </a>
        ) : null}
      </div>
    </section>
  );
}

function StatusItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`statusItem ${tone}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ownerLabel({ isConnected, isOwner }: { isConnected: boolean; isOwner: boolean }) {
  if (!isConnected) return "Connect";
  return isOwner ? "Owner" : "Not owner";
}

function parseAddresses(value: string): ParsedAddresses {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.toLowerCase() !== "address");

  const candidates = tokens.filter((token) => token.startsWith("0x"));
  const invalid = candidates.filter((token) => !isAddress(token));
  const unique = new Map<string, Address>();

  for (const token of candidates) {
    if (isAddress(token)) {
      const address = getAddress(token);
      unique.set(address.toLowerCase(), address);
    }
  }

  return { valid: Array.from(unique.values()), invalid };
}

function chunkAddresses(addresses: Address[], size: number) {
  const chunks: Address[][] = [];
  for (let index = 0; index < addresses.length; index += size) {
    chunks.push(addresses.slice(index, index + size));
  }
  return chunks;
}

function allowlistGasLimit(accountCount: number) {
  return ALLOWLIST_BASE_GAS_LIMIT + BigInt(accountCount) * ALLOWLIST_GAS_LIMIT_PER_ACCOUNT;
}

function compareAllowlistRows(a: AllowlistRow, b: AllowlistRow) {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber > b.blockNumber ? -1 : 1;
  }
  return b.logIndex - a.logIndex;
}

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusLabel(value: unknown) {
  if (value === true) return "listed";
  if (value === false) return "not listed";
  return "checking";
}

function claimStatusLabel(value: unknown) {
  if (value === true) return "claimed";
  if (value === false) return "not claimed";
  return "checking";
}
