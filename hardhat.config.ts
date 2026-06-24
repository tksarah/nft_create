import "@nomicfoundation/hardhat-toolbox";
import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

loadEnv();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const minatoRpcUrl =
  process.env.SONEIUM_MINATO_RPC_URL ?? "https://rpc.minato.soneium.org/";

function normalizePrivateKey(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? normalized : undefined;
}

const deployerPrivateKey = normalizePrivateKey(privateKey);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    minato: {
      url: minatoRpcUrl,
      chainId: 1946,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      minato: process.env.BLOCKSCOUT_API_KEY || "empty",
    },
    customChains: [
      {
        network: "minato",
        chainId: 1946,
        urls: {
          apiURL: "https://soneium-minato.blockscout.com/api",
          browserURL: "https://soneium-minato.blockscout.com",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
