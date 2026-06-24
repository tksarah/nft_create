import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

async function main() {
  const imageCid = requireEnv("NFT_IMAGE_CID");
  const outputPath = process.argv[2] ?? "assets/metadata.json";
  const metadata = {
    name: optionalEnv("NFT_NAME") ?? "Community Attendance Proof",
    description:
      optionalEnv("NFT_DESCRIPTION") ??
      "Participation proof for the community event on Soneium Minato.",
    image: imageCid.startsWith("ipfs://") ? imageCid : `ipfs://${imageCid}`,
    external_url: optionalEnv("NFT_EXTERNAL_URL"),
    attributes: [
      {
        trait_type: "Network",
        value: "Soneium Minato",
      },
      {
        trait_type: "Type",
        value: "Attendance SBT",
      },
      {
        trait_type: "Transferability",
        value: "Soulbound",
      },
    ],
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(`Metadata written: ${outputPath}`);
  console.log(`Image: ${metadata.image}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
