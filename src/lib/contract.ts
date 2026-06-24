import type { Address } from "viem";

export const attendanceSbtAbi = [
  {
    type: "event",
    name: "AllowlistSet",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowlisted",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claimOpen",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setAllowlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setClaimOpen",
    stateMutability: "nonpayable",
    inputs: [{ name: "isOpen", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "metadataURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export function getContractAddress(): Address | undefined {
  const value = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return undefined;
  }
  return value as Address;
}

export function getContractDeployBlock(): bigint | undefined {
  const value = process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK;
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  return BigInt(value);
}
