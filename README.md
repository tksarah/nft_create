# Soneium Minato Attendance SBT

Soneium Minato testnet向けの参加証SBT mintサイトです。管理者は `/admin` からallowlistをオンチェーン更新し、参加者は `/` から1回だけClaimできます。NFTはSoulbound仕様のため、mint後の通常転送はできません。

## ローカル開発

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run compile
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Mint画面は `http://127.0.0.1:3000/`、管理画面は `http://127.0.0.1:3000/admin` です。

## 必要な環境変数

開発・デプロイ作業では `.env` を使います。

- `DEPLOYER_PRIVATE_KEY`: Minatoへコントラクトをデプロイするowner walletの秘密鍵
- `PINATA_JWT`: NFT画像とmetadataをPinataへアップロードするJWT
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: RainbowKit/WalletConnectのProject ID
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: デプロイ済みコントラクトアドレス
- `NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK`: `AllowlistSet` イベント取得開始ブロック
- `ADMIN_BASIC_AUTH_USER`: `/admin` のBasic認証ユーザー名
- `ADMIN_BASIC_AUTH_PASSWORD`: `/admin` のBasic認証パスワード
- `NFT_METADATA_URI`: コントラクトに設定するmetadata URI

production Webコンテナには `DEPLOYER_PRIVATE_KEY`、`PINATA_JWT`、`BLOCKSCOUT_API_KEY` を渡さないでください。

## NFT Asset Flow

最終NFT画像を `assets/nft.png` に置きます。

```powershell
npm.cmd run pinata:upload -- assets/nft.png --name community-attendance.png
```

返ってきた画像CIDを `.env` の `NFT_IMAGE_CID` に入れてmetadataを生成します。

```powershell
npm.cmd run metadata
npm.cmd run pinata:upload -- assets/metadata.json --name community-attendance-metadata.json
```

metadata CIDを `NFT_METADATA_URI=ipfs://<metadataCID>` として `.env` に設定します。

## Contract

```powershell
npm.cmd run deploy:minato
```

デプロイ後に表示されたcontract addressを `NEXT_PUBLIC_CONTRACT_ADDRESS` に設定します。管理画面のallowlist一覧には、デプロイブロックを `NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK` として設定します。

Blockscout/Sourcify verifyは任意です。ソース公開を伴うため、実行前に明示的に確認してください。

## Allowlist Admin

`/admin` を開き、owner walletで接続します。
`/admin` はBasic認証が必要です。開く前に `ADMIN_BASIC_AUTH_USER` と `ADMIN_BASIC_AUTH_PASSWORD` を設定してください。

- `Add to allowlist`: 入力したアドレスをMint対象にします。
- `Remove from allowlist`: 入力したアドレスをMint対象から外します。
- `Open claim` / `Close claim`: Claim受付状態を切り替えます。
- `Refresh list`: `AllowlistSet` イベントから現在有効なallowlist一覧を復元します。

複数アドレスやCSV貼り付けに対応しています。送信は100件ごとのbatch transactionです。

## Claim手順

1. 管理者が `/admin` で対象アドレスをallowlistへ追加します。
2. 管理者が `Open claim` を実行し、Tx confirmedまで待ちます。
3. 参加者がMint画面 `/` を開き、Minato networkでallowlist済みウォレットを接続します。
4. 表示が `Eligible` かつ `Claim Open` になったら `Claim SBT` を押して承認します。

`Eligible` でも `Claim closed` の場合はClaimできません。

## Docker Compose公開

既存Caddyコンテナの後ろでNext.jsを `nft-mint-app:3000` として起動します。

```powershell
Copy-Item .env.production.example .env.production
```

`.env.production` に公開用の値を設定してください。

```powershell
docker compose --env-file .env.production build nft-mint-app
docker compose --env-file .env.production up -d nft-mint-app
```

`docker-compose.yml` は既存Caddyと同じexternal networkに参加する前提です。既定値は `DOCKER_NETWORK=caddy` です。既存composeのnetwork名が異なる場合は `.env.production` の `DOCKER_NETWORK` を合わせてください。

## Caddyfile追加例

既存Caddyfileへ以下のsite blockを追加します。同じ内容を `Caddyfile.nft-mint.example` にも置いています。

```caddyfile
{$NFT_MINT_DOMAIN} {
        log {
                output stdout
                format json
        }

        header {
                Strict-Transport-Security "max-age=31536000; includeSubDomains"
                X-Content-Type-Options "nosniff"
                Referrer-Policy "strict-origin-when-cross-origin"
                X-Frame-Options "DENY"
                Permissions-Policy "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
        }

        encode zstd gzip
        reverse_proxy nft-mint-app:3000
}
```

Caddy側の環境変数に `NFT_MINT_DOMAIN` を追加し、Caddyをreloadしてください。

公開後は以下を確認します。

- `https://{$NFT_MINT_DOMAIN}/` でMint画面が表示される
- `https://{$NFT_MINT_DOMAIN}/admin` で管理画面が表示される
- owner walletでallowlist一覧更新と `Open claim` ができる
- allowlist済みウォレットでClaim導線が表示される
