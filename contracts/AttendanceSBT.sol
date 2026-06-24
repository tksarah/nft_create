// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AttendanceSBT is ERC721, Ownable {
    error ClaimClosed();
    error AlreadyClaimed();
    error NotAllowlisted();
    error Soulbound();
    error MetadataFrozen();
    error EmptyMetadataURI();
    error InvalidAccount();

    bool public claimOpen;
    bool public metadataFrozen;

    mapping(address => bool) public allowlisted;
    mapping(address => bool) public hasClaimed;

    string private _metadataURI;
    uint256 private _nextTokenId = 1;

    event Claimed(address indexed account, uint256 indexed tokenId);
    event AllowlistSet(address indexed account, bool allowed);
    event ClaimOpenSet(bool isOpen);
    event MetadataURISet(string metadataURI);
    event MetadataLocked();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address initialOwner_,
        bool claimOpen_
    ) ERC721(name_, symbol_) Ownable(initialOwner_) {
        if (bytes(metadataURI_).length == 0) {
            revert EmptyMetadataURI();
        }

        _metadataURI = metadataURI_;
        claimOpen = claimOpen_;

        emit MetadataURISet(metadataURI_);
        emit ClaimOpenSet(claimOpen_);
    }

    function claim() external returns (uint256 tokenId) {
        if (!claimOpen) {
            revert ClaimClosed();
        }
        if (hasClaimed[msg.sender]) {
            revert AlreadyClaimed();
        }

        if (!allowlisted[msg.sender]) {
            revert NotAllowlisted();
        }

        hasClaimed[msg.sender] = true;
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        emit Claimed(msg.sender, tokenId);
    }

    function setClaimOpen(bool isOpen) external onlyOwner {
        claimOpen = isOpen;
        emit ClaimOpenSet(isOpen);
    }

    function setAllowlist(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account == address(0)) {
                revert InvalidAccount();
            }

            allowlisted[account] = allowed;
            emit AllowlistSet(account, allowed);
        }
    }

    function setMetadataURI(string calldata newMetadataURI) external onlyOwner {
        if (metadataFrozen) {
            revert MetadataFrozen();
        }
        if (bytes(newMetadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        _metadataURI = newMetadataURI;
        emit MetadataURISet(newMetadataURI);
    }

    function freezeMetadata() external onlyOwner {
        metadataFrozen = true;
        emit MetadataLocked();
    }

    function metadataURI() external view returns (string memory) {
        return _metadataURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _metadataURI;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }

        return super._update(to, tokenId, auth);
    }
}
