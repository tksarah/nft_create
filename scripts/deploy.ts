import { config as loadEnv } from "dotenv";
import hre from "hardhat";

loadEnv();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optionalBigIntEnv(name: string) {
  const value = process.env[name];
  return value ? BigInt(value) : undefined;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "Missing or invalid DEPLOYER_PRIVATE_KEY. It must be a 32-byte hex private key, with or without 0x prefix.",
    );
  }
  const name = process.env.NFT_NAME || "Community Attendance Proof";
  const symbol = process.env.NFT_SYMBOL || "CAP";
  const metadataURI = requireEnv("NFT_METADATA_URI");
  const claimOpen = process.env.CLAIM_OPEN === "true";
  const deployGasLimit = optionalBigIntEnv("DEPLOY_GAS_LIMIT");

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Metadata URI: ${metadataURI}`);
  console.log(`Claim open: ${claimOpen}`);
  if (deployGasLimit) {
    console.log(`Deploy gas limit: ${deployGasLimit}`);
  }

  const AttendanceSBT = await hre.ethers.getContractFactory("AttendanceSBT");
  const sbt = await AttendanceSBT.deploy(
    name,
    symbol,
    metadataURI,
    deployer.address,
    claimOpen,
    deployGasLimit ? { gasLimit: deployGasLimit } : {},
  );

  await sbt.waitForDeployment();
  const address = await sbt.getAddress();

  console.log(`AttendanceSBT deployed: ${address}`);
  console.log(`Explorer: https://soneium-minato.blockscout.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
