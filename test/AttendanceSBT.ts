import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

const METADATA_URI = "ipfs://bafybeigdyrztattendancemetadata";

describe("AttendanceSBT", function () {
  async function deployFixture() {
    const [owner, allowed, other, recipient] = await ethers.getSigners();

    const AttendanceSBT = await ethers.getContractFactory("AttendanceSBT");
    const sbt = await AttendanceSBT.deploy(
      "Community Attendance Proof",
      "CAP",
      METADATA_URI,
      owner.address,
      true,
    );

    return { sbt, owner, allowed, other, recipient };
  }

  it("allows the owner to add and remove allowlisted wallets", async function () {
    const { sbt, allowed, other } = await deployFixture();

    await expect(sbt.setAllowlist([allowed.address, other.address], true))
      .to.emit(sbt, "AllowlistSet")
      .withArgs(allowed.address, true);

    expect(await sbt.allowlisted(allowed.address)).to.equal(true);
    expect(await sbt.allowlisted(other.address)).to.equal(true);

    await sbt.setAllowlist([other.address], false);

    expect(await sbt.allowlisted(allowed.address)).to.equal(true);
    expect(await sbt.allowlisted(other.address)).to.equal(false);
  });

  it("rejects allowlist updates from non-owners", async function () {
    const { sbt, other, allowed } = await deployFixture();

    await expect(
      sbt.connect(other).setAllowlist([allowed.address], true),
    ).to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount");
  });

  it("allows an allowlisted wallet to claim once", async function () {
    const { sbt, allowed } = await deployFixture();

    await sbt.setAllowlist([allowed.address], true);

    await expect(sbt.connect(allowed).claim())
      .to.emit(sbt, "Claimed")
      .withArgs(allowed.address, 1);

    expect(await sbt.ownerOf(1)).to.equal(allowed.address);
    expect(await sbt.hasClaimed(allowed.address)).to.equal(true);
    expect(await sbt.tokenURI(1)).to.equal(METADATA_URI);
  });

  it("rejects non-allowlisted wallets", async function () {
    const { sbt, other } = await deployFixture();

    await expect(sbt.connect(other).claim()).to.be.revertedWithCustomError(
      sbt,
      "NotAllowlisted",
    );
  });

  it("prevents a removed wallet from claiming if it has not claimed yet", async function () {
    const { sbt, allowed } = await deployFixture();

    await sbt.setAllowlist([allowed.address], true);
    await sbt.setAllowlist([allowed.address], false);

    await expect(sbt.connect(allowed).claim()).to.be.revertedWithCustomError(
      sbt,
      "NotAllowlisted",
    );
  });

  it("rejects double claims even if allowlist status changes later", async function () {
    const { sbt, allowed } = await deployFixture();

    await sbt.setAllowlist([allowed.address], true);
    await sbt.connect(allowed).claim();
    await sbt.setAllowlist([allowed.address], false);
    await sbt.setAllowlist([allowed.address], true);

    await expect(sbt.connect(allowed).claim()).to.be.revertedWithCustomError(
      sbt,
      "AlreadyClaimed",
    );
  });

  it("can close claiming", async function () {
    const { sbt, allowed } = await deployFixture();

    await sbt.setAllowlist([allowed.address], true);
    await sbt.setClaimOpen(false);

    await expect(sbt.connect(allowed).claim()).to.be.revertedWithCustomError(
      sbt,
      "ClaimClosed",
    );
  });

  it("prevents transfers after mint", async function () {
    const { sbt, allowed, recipient } = await deployFixture();

    await sbt.setAllowlist([allowed.address], true);
    await sbt.connect(allowed).claim();

    await expect(
      sbt.connect(allowed).transferFrom(allowed.address, recipient.address, 1),
    ).to.be.revertedWithCustomError(sbt, "Soulbound");
  });

  it("can freeze metadata", async function () {
    const { sbt } = await deployFixture();

    await sbt.setMetadataURI("ipfs://newmetadata");
    await sbt.freezeMetadata();

    await expect(sbt.setMetadataURI("ipfs://another")).to.be.revertedWithCustomError(
      sbt,
      "MetadataFrozen",
    );
  });
});
