"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import type { Hash } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { soneiumMinato } from "@/lib/chains";
import { attendanceSbtAbi, getContractAddress } from "@/lib/contract";

const CLAIM_GAS_LIMIT = 180_000n;

export function MintPanel() {
  const contractAddress = useMemo(() => getContractAddress(), []);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [txHash, setTxHash] = useState<Hash>();

  const isMinato = chainId === soneiumMinato.id;
  const isConfigured = Boolean(contractAddress);

  const claimOpen = useReadContract({
    address: contractAddress,
    abi: attendanceSbtAbi,
    functionName: "claimOpen",
    query: {
      enabled: isConfigured,
    },
  });

  const allowlisted = useReadContract({
    address: contractAddress,
    abi: attendanceSbtAbi,
    functionName: "allowlisted",
    args: address ? [address] : undefined,
    query: {
      enabled: isConfigured && Boolean(address),
    },
  });

  const hasClaimed = useReadContract({
    address: contractAddress,
    abi: attendanceSbtAbi,
    functionName: "hasClaimed",
    args: address ? [address] : undefined,
    query: {
      enabled: isConfigured && Boolean(address),
    },
  });

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (receipt.isSuccess) {
      void hasClaimed.refetch();
      void allowlisted.refetch();
    }
  }, [allowlisted, hasClaimed, receipt.isSuccess]);

  const button = getButtonState({
    isConnected,
    isConfigured,
    isMinato,
    claimOpen: claimOpen.data,
    hasClaimed: hasClaimed.data,
    allowlisted: allowlisted.data,
    isCheckingAllowlist: allowlisted.isLoading,
    isSwitching,
    isWriting,
    isConfirming: receipt.isLoading,
  });

  async function handlePrimaryAction() {
    if (!isConnected) {
      return;
    }

    if (!isMinato) {
      await switchChainAsync({ chainId: soneiumMinato.id });
      return;
    }

    if (!contractAddress || !allowlisted.data) {
      return;
    }

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: attendanceSbtAbi,
      functionName: "claim",
      chainId: soneiumMinato.id,
      gas: CLAIM_GAS_LIMIT,
    });
    setTxHash(hash);
  }

  return (
    <div className="mintPanel">
      <header className="panelHeader">
        <p className="eyebrow">Community Proof</p>
        <h1>Attendance SBT</h1>
      </header>

      <div className="walletRow">
        <ConnectButton showBalance={false} chainStatus="name" accountStatus="address" />
      </div>

      <dl className="statusGrid">
        <StatusItem label="Network" value={isMinato ? "Minato" : "Switch required"} tone={isMinato ? "good" : "warn"} />
        <StatusItem label="Contract" value={isConfigured ? "Ready" : "Missing"} tone={isConfigured ? "good" : "warn"} />
        <StatusItem
          label="Claim"
          value={claimOpen.data ? "Open" : "Closed"}
          tone={claimOpen.data ? "good" : "warn"}
        />
        <StatusItem
          label="Wallet"
          value={walletStatus({
            isConnected,
            isCheckingAllowlist: allowlisted.isLoading,
            allowlisted: allowlisted.data,
            hasClaimed: hasClaimed.data,
          })}
          tone={walletTone({
            isConnected,
            isCheckingAllowlist: allowlisted.isLoading,
            allowlisted: allowlisted.data,
            hasClaimed: hasClaimed.data,
          })}
        />
      </dl>

      <button className="primaryButton" type="button" disabled={button.disabled} onClick={handlePrimaryAction}>
        {button.label}
      </button>

      <div className="feedback" aria-live="polite">
        {receipt.isSuccess && txHash ? (
          <a href={`${soneiumMinato.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">
            Transaction confirmed
          </a>
        ) : null}
        {receipt.isError ? <span>{receipt.error.message}</span> : null}
        {!isConfigured ? <span>Set NEXT_PUBLIC_CONTRACT_ADDRESS after deployment.</span> : null}
      </div>
    </div>
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

function walletStatus(input: {
  isConnected: boolean;
  isCheckingAllowlist: boolean;
  allowlisted?: boolean;
  hasClaimed?: boolean;
}) {
  if (!input.isConnected) return "Connect";
  if (input.hasClaimed) return "Claimed";
  if (input.isCheckingAllowlist) return "Checking";
  if (input.allowlisted) return "Eligible";
  return "Not listed";
}

function walletTone(input: {
  isConnected: boolean;
  isCheckingAllowlist: boolean;
  allowlisted?: boolean;
  hasClaimed?: boolean;
}): "good" | "warn" | "neutral" {
  if (!input.isConnected || input.isCheckingAllowlist) return "neutral";
  if (input.hasClaimed || input.allowlisted) return "good";
  return "warn";
}

function getButtonState(input: {
  isConnected: boolean;
  isConfigured: boolean;
  isMinato: boolean;
  claimOpen?: boolean;
  hasClaimed?: boolean;
  allowlisted?: boolean;
  isCheckingAllowlist: boolean;
  isSwitching: boolean;
  isWriting: boolean;
  isConfirming: boolean;
}) {
  if (!input.isConnected) return { disabled: true, label: "Connect wallet" };
  if (!input.isConfigured) return { disabled: true, label: "Contract missing" };
  if (!input.isMinato) return { disabled: input.isSwitching, label: input.isSwitching ? "Switching" : "Switch to Minato" };
  if (input.claimOpen === false) return { disabled: true, label: "Claim closed" };
  if (input.hasClaimed) return { disabled: true, label: "Already claimed" };
  if (input.isCheckingAllowlist) return { disabled: true, label: "Checking wallet" };
  if (!input.allowlisted) return { disabled: true, label: "Not eligible" };
  if (input.isWriting) return { disabled: true, label: "Confirm in wallet" };
  if (input.isConfirming) return { disabled: true, label: "Confirming" };
  return { disabled: false, label: "Claim SBT" };
}
