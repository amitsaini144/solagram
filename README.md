# Solagram

Solagram is a small Solana-based social app with:
- An Anchor/Rust on-chain program (solana-instagram) that manages user profiles, posts, comments, reactions and follows.
- A Next.js frontend that talks to the Anchor program via @coral-xyz/anchor.

Key files
- Anchor program entry: [`anchor_project/programs/solana-instagram/src/lib.rs`](anchor_project/programs/solana-instagram/src/lib.rs)
- Anchor program instructions & state: [`anchor_project/programs/solana-instagram/src/`](anchor_project/programs/solana-instagram/src)
- Anchor tests: [`anchor_project/tests/solana-instagram.ts`](anchor_project/tests/solana-instagram.ts)
- Frontend app: [`frontend/`](frontend)

What it does (brief)
- Users can create on-chain profiles.
- Profiles create posts (with media URI + content), other users can comment and react.
- Follow/unfollow relationships are stored on-chain.
- Tests (under `anchor_project/tests/`) cover happy & unhappy paths for the core flows.

Quick local setup (summary)

Prerequisites
- Rust toolchain + Cargo
- Solana CLI
- Anchor CLI
- Node.js (16+) and your preferred package manager (npm/pnpm/yarn)

Clone
```bash
git clone https://github.com/amitsaini144/solagram.git
cd solagram
```

Run Anchor program & tests
```bash
# go to anchor project
cd anchor_project

# install JS deps used by tests (if any)
npm install

# build the program
anchor build

# run on local validator and run anchor tests
anchor test
```
Notes:
- `anchor test` launches a local test validator and runs the test suite found at [`anchor_project/tests/solana-instagram.ts`](anchor_project/tests/solana-instagram.ts).
- If you want to run the program locally without tests, use `anchor build` then deploy or run a local validator.

Run the frontend
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```
The frontend talks to the on-chain program declared in [`anchor_project/programs/solana-instagram/src/lib.rs`](anchor_project/programs/solana-instagram/src/lib.rs). Ensure your local validator / deployed program ID (in `anchor_project/Anchor.toml`) is accessible to the frontend.

Useful tips
- Program ID is declared in the Anchor Rust program: see [`anchor_project/programs/solana-instagram/src/lib.rs`](anchor_project/programs/solana-instagram/src/lib.rs).
- Frontend uses the IDL at `target/idl/solana_instagram.json` and the generated TS types at `target/types/solana_instagram.ts`.
- If you change the Rust program, re-run `anchor build` and redeploy or re-run `anchor test`.

For more details, open:
- Anchor lib: [`anchor_project/programs/solana-instagram/src/lib.rs`](anchor_project/programs/solana-instagram/src/lib.rs)
- Tests: [`anchor_project/tests/solana-instagram.ts`](anchor_project/tests/solana-instagram.ts)