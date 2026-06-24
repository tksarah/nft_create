import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function getFilePath() {
  return process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("Missing PINATA_JWT");
  }

  const filePath = getFilePath();
  if (!filePath) {
    throw new Error("Usage: npm.cmd run pinata:upload -- <file> --name <pinata-name>");
  }

  const displayName = getArg("--name") ?? basename(filePath);
  const bytes = await readFile(filePath);
  const file = new File([bytes], basename(filePath), {
    type: contentTypeFor(filePath),
  });

  const form = new FormData();
  form.append("file", file);
  form.append("network", "public");
  form.append("name", displayName);

  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Pinata upload failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const gateway = process.env.PINATA_GATEWAY;
  const cid = body.cid ?? body.data?.cid;

  console.log(JSON.stringify(body, null, 2));
  if (cid) {
    console.log(`CID: ${cid}`);
    console.log(`IPFS URI: ipfs://${cid}`);
    if (gateway) {
      console.log(`Gateway URL: https://${gateway}/ipfs/${cid}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
