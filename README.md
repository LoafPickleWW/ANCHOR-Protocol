# A.N.C.H.O.R Protocol Specification
### Algorand Native Cryptographic Hash Origin Record
**RFC v0.1 — Open for Community Review**
*Joseph G. Cecala, E.I.T. // LoafPickle Worldwide*

---

## Abstract

ANCHOR is a self-sovereign, decentralized software supply chain integrity protocol built on Algorand. It allows any developer to cryptographically commit the hash of a software artifact to their own Algorand wallet at publish time, creating a permanent, tamper-evident, timestamped record that any downstream consumer can independently verify without trusting any intermediary — including the package registry that distributed the artifact.

ANCHOR has no central protocol address, no registry, no account creation, and no vendor. The developer's wallet is the signing identity. The Algorand ledger is the transparency log. The math is the trust.

---

## Motivation

Software supply chain attacks have demonstrated repeatedly that the path between an author and a consumer is an attack surface. The package you installed last month, pulled from the same registry URL with the same version string, might not contain the same code it did when you first evaluated it.

Existing solutions — npm provenance, Sigstore, package lock files — address parts of this problem but all rely on a trusted intermediary at some point in the chain. npm provenance trusts GitHub Actions and npm's own infrastructure. Sigstore trusts the Rekor transparency log operated by the Linux Foundation. Package lock files trust that the registry serves the same content for the same version indefinitely.

ANCHOR's approach is different. The signing identity is a wallet the developer controls. The transparency log is Algorand's public ledger, operated by a decentralized validator set that neither the developer nor any single company controls. Verification requires no account, no API key, and no trust in any party beyond the cryptographic primitives themselves.

---

## Design Principles

**Self-sovereign by default.** Every developer's wallet is their own protocol instance. There is no central address, no registration with ANCHOR, no dependency on LoafPickle Worldwide's infrastructure for any part of the protocol to function.

**Non-invasive.** ANCHOR does not replace existing distribution infrastructure. Packages still go to npm. Binaries still go to GitHub Releases. ANCHOR adds one additional step — anchoring the hash — that runs alongside existing workflows without modifying them.

**Adoption-tolerant verification.** A package that has never used ANCHOR is reported as unenrolled, not failed. The protocol does not punish the ecosystem for not having adopted it yet.

**Permissionless verification.** Anyone can verify any anchor transaction from any wallet against any artifact without contacting ANCHOR, LoafPickle Worldwide, or any service we operate. The Algorand indexer is public. The math is open.

---

## Definitions

**Signing Wallet** — An Algorand wallet controlled by the developer, used exclusively for broadcasting anchor transactions. Recommended to be a dedicated wallet separate from the developer's operational or financial wallets.

**Anchor Transaction** — A zero-value Algorand transaction sent from the signing wallet to itself, with a structured note field containing the artifact identifier and SHA-256 hash.

**Registration Transaction** — A one-time anchor transaction that establishes the on-chain link between a signing wallet and one or more package names.

**Pre-publish Anchor** — An anchor transaction broadcast before the artifact is published to a registry, recording the developer's intent.

**Post-publish Anchor** — An anchor transaction broadcast after the artifact is live on the registry, confirming that what was published matches the pre-publish intent.

**Enrolled Package** — A package for which at least one registration transaction exists on-chain from a signing wallet that also appears in the package's metadata.

**Cross-validation** — The act of independently confirming the signing wallet address from both on-chain registration transactions and package metadata, and requiring both sources to agree before trusting either.

---

## Transaction Format

All ANCHOR transactions share the following structure:

- **Sender:** Developer's signing wallet
- **Receiver:** Developer's signing wallet (self-transaction)
- **Amount:** 0 ALGO
- **Fee:** 0.001 ALGO (minimum network fee)
- **Note:** UTF-8 encoded string per the formats below

### Note Field Formats

**Registration:**
```
anchor:register:<package-name>
```

**Pre-publish anchor:**
```
anchor:<package-name>:<version>:pre:sha256:<hex-hash>
```

**Post-publish anchor:**
```
anchor:<package-name>:<version>:post:sha256:<hex-hash>
```

**Multi-artifact releases** use grouped transactions — one transaction per artifact, submitted atomically as an Algorand transaction group. Either all land or none do. A partial anchor is impossible by design.

Example group for a release shipping both CJS and ESM builds:
```
TX 1: anchor:my-package:1.2.3:post:sha256:<cjs-hash>
TX 2: anchor:my-package:1.2.3:post:sha256:<esm-hash>
```

Both transactions carry the same group ID assigned by the Algorand SDK, making the atomic relationship verifiable on-chain.

---

## Identity Model

ANCHOR is fully self-sovereign. The signing wallet address is the developer's identity within the protocol. There is no central registry mapping package names to wallets.

Package name uniqueness is scoped to the wallet. Two developers can both publish a package named `utils` — their anchor transactions are distinguished by the sending wallet address. The verifier always checks `wallet + package name + version` as the composite key, never package name alone.

The on-chain link between a wallet and a package name is established by the registration transaction. The cross-validation step confirms this link also appears in the package's own metadata, providing a second independent source that must agree.

**Wallet compromise** affects only the packages registered to that wallet. Developers with large portfolios may choose to use multiple signing wallets to limit blast radius, though this is optional.

---

## Verification Model

Verification proceeds in the following sequence:

### Step 1 — Resolve signing wallet
Query the package metadata (e.g. `package.json` `anchor` field on the npm registry) for the declared signing wallet address.

### Step 2 — Cross-validate on-chain
Query the Algorand indexer for registration transactions from the declared wallet matching the package name. Both sources must agree on the wallet address. If they disagree, emit a loud cross-validation warning and halt.

### Step 3 — Fetch and hash artifact
Download the artifact from the registry exactly as a consumer would. Compute SHA-256 locally.

### Step 4 — Look up anchor transactions
Query the Algorand indexer for anchor transactions from the signing wallet matching `<package-name>:<version>`.

### Step 5 — Compare hashes
Compare the locally computed hash against the on-chain anchor hash(es).

### Step 6 — Emit result

| State | Meaning | Exit Code |
|---|---|---|
| `verified` | Pre and post anchors found, hashes match | 0 |
| `partial` | Post anchor matches, pre anchor missing | 0 + stderr warning |
| `failed` | Anchor found but hash mismatch | 1 |
| `unenrolled` | No registration transaction found | 0 (informational) |

`--strict` flag promotes `partial` and `unenrolled` to exit 1 for teams that require full chain of custody.

---

## Network Configuration

ANCHOR supports both Algorand mainnet and testnet. Network selection is explicit — there is no automatic detection.

**Mainnet** — Production releases. Anchor transactions are permanent and publicly visible.

**Testnet** — Development and CI testing. Anchor transactions cost no real ALGO. Recommended for testing the integration before going to mainnet.

Network is configured via the `--network` flag or the `ANCHOR_NETWORK` environment variable:

```bash
anchor verify my-package 1.2.3 --network testnet
anchor verify my-package 1.2.3 --network mainnet  # default
```

Default indexer endpoints:
- Mainnet: `https://mainnet-idx.4160.nodely.dev`
- Testnet: `https://testnet-idx.4160.nodely.dev`

Both are overridable via `--indexer` flag for teams running their own infrastructure.

---

## Package Metadata

To enable cross-validation, the developer publishes their signing wallet address in `package.json`:

```json
{
  "name": "my-package",
  "version": "1.2.3",
  "anchor": {
    "wallet": "ABCD1234EFGH5678...",
    "network": "mainnet"
  }
}
```

This field is the second source in cross-validation. It is not the primary trust anchor — the on-chain registration transaction is. But requiring both to agree means neither source alone is sufficient to mislead the verifier.

---

## Security Considerations

**Wallet key compromise.** If a signing wallet's mnemonic is exposed, an attacker can publish fraudulent anchor transactions for any package registered to that wallet. Mitigation: use a dedicated signing wallet with minimal balance, rotate it by publishing a new registration transaction from a new wallet and updating package metadata, and treat the old wallet's anchors as untrusted from the rotation timestamp onward.

**Pre-image attacks.** SHA-256 is used for artifact hashing. No known practical pre-image attacks exist against SHA-256. If the cryptographic landscape changes materially, the note format is versioned to support algorithm migration.

**Registry metadata tampering.** The `anchor` field in `package.json` is served by the npm registry. A compromised registry could serve a modified wallet address. Cross-validation catches this if the on-chain registration record disagrees. A registry that controls both the metadata and the Algorand indexer simultaneously would defeat cross-validation — this attack requires compromising two entirely independent systems.

**Replay attacks.** Anchor transactions are scoped to `package-name + version + pre/post`. A replay of a valid anchor transaction for a different version would not match the version being verified. Transaction IDs are unique on Algorand by construction.

**Partial group delivery.** Algorand transaction groups are atomic. A group either fully confirms or fully fails. There is no partial anchor state at the transaction level.

---

## What ANCHOR Does Not Do

ANCHOR does not verify that the code in a package is safe, correct, or free of malicious intent. It only verifies that what you downloaded matches what the author published. A developer can anchor a malicious package — ANCHOR will verify it faithfully.

ANCHOR does not prevent a developer from publishing a new version with a new anchor that contains different or malicious code. Version pinning and semantic versioning practices are outside ANCHOR's scope.

ANCHOR does not replace code review, dependency auditing, or security scanning. It is one layer in a defense-in-depth approach to supply chain integrity.

---

## Open Questions for Community Review

The following design decisions are explicitly open for feedback:

1. **Note field encoding** — UTF-8 plain text is human-readable and easy to debug but wastes bytes. A compact binary encoding would fit more data in 1KB but requires tooling to inspect. Is plain text the right default?

2. **Algorithm agility** — The current format hardcodes `sha256`. Should the format version be explicit in the note field to support future algorithm migration without a breaking change?

3. **Wallet rotation** — The current spec has no formal wallet rotation mechanism beyond publishing a new registration and updating metadata. Is this sufficient or does rotation need a more explicit on-chain signal?

4. **Cross-chain** — The protocol design is not inherently Algorand-specific beyond the transaction format. Should future versions of the spec define an abstract interface that other chains could implement?

5. **Revocation** — There is currently no way to revoke an anchor transaction once it is on-chain. Should the spec define a revocation transaction format for situations where a published anchor is known to be incorrect?

---

## Implementation Status

| Component | Status |
|---|---|
| RFC | v0.1 — open for review |
| `@loafpickleww/anchor` | **Phase 1 & 2 Complete** (v1.0.0) |
| GitHub Action | **Complete** (v1) |
| Verification CLI | **Complete** |
| npm metadata integration | Planned — Phase 3 |

---

## Live Demo & Receipts

The protocol has been successfully verified on the Algorand Testnet.

- **Demo Signing Wallet:** `W6MZUOCM7ES5R7VPX4OK3P5R4V7FAR4F5UIU4WMMRB4KCRBL7KOF3R6TKU`
- **Registration Receipt:** [Z5UQLMCJAS27ZXC5...](https://testnet.algoexplorer.io/tx/Z5UQLMCJAS27ZXC57644Y2PBKJM5FVC5TYCPFIZGZVEKIIKBLM7A)
- **Anchor Receipt:** [OIKSBFBGXBF2TX5B...](https://testnet.algoexplorer.io/tx/OIKSBFBGXBF2TX5BZ5SPSZ3U6RKL4XYTAHV4WMXPU7RG3HQY5ULA)

### Quick Start

```bash
# 1. Install CLI
npm install -g @loafpickleww/anchor

# 2. Initialize your signing wallet
anchor init --network testnet

# 3. Anchor a release
anchor publish --release 1.0.0

# 4. Verify any package
anchor verify my-package 1.0.0
```

Reference implementation and demo: *[github link — coming soon]*

---

## Prior Art

- **Sigstore / Rekor** — Transparency log for code signing events. Centralized infrastructure operated by the Linux Foundation. ANCHOR's approach is philosophically similar but uses a public blockchain as the transparency log rather than a dedicated service.
- **npm provenance** — Links published packages to GitHub Actions runs via OIDC. Trusts GitHub and npm infrastructure. ANCHOR is complementary — the two can coexist and cross-validate.
- **The Update Framework (TUF)** — Comprehensive framework for securing software update systems. More complex and opinionated than ANCHOR. ANCHOR does not attempt to replace TUF for systems that need its full feature set.
- **B.E.A.C.O.N (LoafPickle Worldwide)** — Blockchain-Encrypted Algorand Connection Over Note-field. Uses Algorand transaction note fields as a signaling layer for peer-to-peer WebRTC connections. ANCHOR applies the same architectural pattern to software supply chain integrity.

---

## Contributing

This is an open RFC. We are explicitly looking for:

- Cryptographic review of the identity and verification model
- Edge cases in the verification flow
- Feedback from developers who maintain npm packages at scale
- Alternative approaches to the wallet rotation and revocation problems

Read the spec, poke holes in it, or contribute to the implementation at *[github link — coming soon]*.

---

*Joseph G. Cecala, E.I.T. // LoafPickle Worldwide*

*Disclaimer: These views are my own and don't reflect anyone or anything beyond that.*
