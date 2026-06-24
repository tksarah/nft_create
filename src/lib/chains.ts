import { defineChain } from "viem";

export const soneiumMinato = defineChain({
  id: 1946,
  name: "Soneium Minato",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.minato.soneium.org/"],
    },
    public: {
      http: ["https://rpc.minato.soneium.org/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://soneium-minato.blockscout.com",
    },
  },
  testnet: true,
});
