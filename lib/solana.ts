import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import FaucetDropsIDL from './faucet_drops_idl.json'; // Ensure this path is correct
import { Transaction, ComputeBudgetProgram } from '@solana/web3.js';

// Replace with your deployed Solana program ID
export const SOLANA_PROGRAM_ID = new PublicKey("YOUR_SOLANA_PROGRAM_ID_HERE");

// Standard backend addresses for Faucet Drops
const BACKEND_SIGNER_PUBKEY = new PublicKey("YOUR_BACKEND_PUBKEY_HERE");
const PLATFORM_FEE_VAULT = new PublicKey("YOUR_FEE_VAULT_PUBKEY_HERE");

/**
 * Helper to initialize the Anchor Program instance
 */
export function getSolanaProgram(connection: Connection, wallet: any): Program<any> {
  const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
  
  // 1. Inject the address into the IDL and cast through unknown to fix TS2352
  const idl = {
    ...FaucetDropsIDL,
    address: SOLANA_PROGRAM_ID.toBase58(),
  } as unknown as Idl;

  // 2. Pass only the idl and provider to fix TS2345
  // 3. Return Program<any> to fix TS2339 (missing faucetState, claimStatus, etc.)
  return new Program<any>(idl, provider);
}

/**
 * ==========================================
 * PDA DERIVATION HELPERS
 * ==========================================
 */
export const getFaucetPda = (name: string) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("faucet"), Buffer.from(name)], // Assuming authority isn't in seed based on earlier TS, if it is, add it!
    SOLANA_PROGRAM_ID
  );
};

export const getTokenVaultPda = (faucetPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), faucetPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );
};

export const getWhitelistEntryPda = (faucetPubkey: PublicKey, userPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), faucetPubkey.toBuffer(), userPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );
};

export const getAdminRecordPda = (faucetPubkey: PublicKey, adminPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("admin"), faucetPubkey.toBuffer(), adminPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );
};

export const getClaimStatusPda = (faucetPubkey: PublicKey, userPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), faucetPubkey.toBuffer(), userPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );
};


/**
 * ==========================================
 * CORE FUNCTIONS
 * ==========================================
 */

export async function createSolanaFaucet(
  connection: Connection,
  wallet: any,
  name: string,
  tokenMintAddress: string,
  claimAmount: number,
  startTime: number,
  endTime: number,
  useBackend: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const tokenMint = new PublicKey(tokenMintAddress);
  
  const [faucetPda, faucetBump] = getFaucetPda(name);
  const [tokenVaultPda] = getTokenVaultPda(faucetPda);

  const faucetTypeU8 = useBackend ? 0 : 1;

  try {
    const tx = await program.methods.initializeFaucet(
      name,
      new BN(claimAmount),
      new BN(startTime),
      new BN(endTime),
      faucetTypeU8,
      { faucet: faucetBump }
    )
    .accounts({
      authority: wallet.publicKey,
      backendSigner: BACKEND_SIGNER_PUBKEY,
      feeVault: PLATFORM_FEE_VAULT,
      tokenMint: tokenMint,
      faucet: faucetPda,
      tokenVault: tokenVaultPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SystemProgram.programId, 
    })
    .rpc();

    console.log("✅ Solana Faucet Created. Tx:", tx);
    return faucetPda.toString();
  } catch (error: any) {
    console.error("❌ Error creating Solana faucet:", error);
    throw new Error(error.message || "Failed to create Solana faucet");
  }
}

export async function fundSolanaFaucet(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  amount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const faucetState = await program.account.faucetState.fetch(faucetPubkey);
    
    const funderTokenAccount = await getAssociatedTokenAddress(faucetState.tokenMint, wallet.publicKey);
    const platformFeeAccount = await getAssociatedTokenAddress(faucetState.tokenMint, BACKEND_SIGNER_PUBKEY);

    const tx = await program.methods.fundFaucet(new BN(amount))
      .accounts({
        funder: wallet.publicKey,
        faucet: faucetPubkey,
        funderTokenAccount: funderTokenAccount,
        tokenVault: faucetState.tokenVault,
        backendWallet: BACKEND_SIGNER_PUBKEY,
        platformFeeAccount: platformFeeAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Solana Faucet Funded. Tx:", tx);
    return tx;
  } catch (error: any) {
    console.error("❌ Error funding Solana faucet:", error);
    throw new Error(error.message || "Failed to fund Solana faucet");
  }
}

export async function withdrawSolanaTokens(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  amount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const faucetState = await program.account.faucetState.fetch(faucetPubkey);
    const adminTokenAccount = await getAssociatedTokenAddress(faucetState.tokenMint, wallet.publicKey);

    const tx = await program.methods.withdraw(new BN(amount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        tokenVault: faucetState.tokenVault,
        adminTokenAccount: adminTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Tokens Withdrawn. Tx:", tx);
    return tx;
  } catch (error: any) {
    console.error("❌ Error withdrawing from Solana faucet:", error);
    throw new Error(error.message || "Failed to withdraw tokens");
  }
}

/**
 * Note: `claim` is typically executed by your Node.js backend using the backend's Keypair, 
 * not the frontend, because the backend must sign. This is included here if you share this file.
 */
export async function claimSolanaTokensBackend(
  connection: Connection,
  backendWallet: any, // This must be the actual backend Keypair!
  faucetAddress: string,
  recipientAddress: string,
  amount: number,
  isWhitelisted: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, backendWallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const recipientPubkey = new PublicKey(recipientAddress);

  try {
    const faucetState = await program.account.faucetState.fetch(faucetPubkey);
    const recipientTokenAccount = await getAssociatedTokenAddress(faucetState.tokenMint, recipientPubkey);
    const [claimStatusPda] = getClaimStatusPda(faucetPubkey, recipientPubkey);
    
    // Optional whitelist entry
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, recipientPubkey);

    const tx = await program.methods.claim(new BN(amount))
      .accounts({
        backend: backendWallet.publicKey,
        recipient: recipientPubkey,
        faucet: faucetPubkey,
        tokenVault: faucetState.tokenVault,
        recipientTokenAccount: recipientTokenAccount,
        claimStatus: claimStatusPda,
        whitelistEntry: isWhitelisted ? whitelistEntryPda : null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error("❌ Error claiming Solana tokens:", error);
    throw error;
  }
}


/**
 * ==========================================
 * MANAGEMENT / ADMIN FUNCTIONS
 * ==========================================
 */

export async function addToSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string,
  customAmount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const tx = await program.methods.addToWhitelist(new BN(customAmount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to add to whitelist");
  }
}

export async function removeFromSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const tx = await program.methods.removeFromWhitelist()
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to remove from whitelist");
  }
}

export async function addSolanaAdmin(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  adminAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const adminPubkey = new PublicKey(adminAddress);
  const [adminRecordPda] = getAdminRecordPda(faucetPubkey, adminPubkey);

  try {
    const tx = await program.methods.addAdmin(adminPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        adminRecord: adminRecordPda,
        systemProgram: SystemProgram.programId,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to add admin");
  }
}

export async function removeSolanaAdmin(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  adminAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const adminPubkey = new PublicKey(adminAddress);
  const [adminRecordPda] = getAdminRecordPda(faucetPubkey, adminPubkey);

  try {
    const tx = await program.methods.removeAdmin(adminPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        adminRecord: adminRecordPda,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to remove admin");
  }
}

export async function resetSingleSolanaClaim(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [claimStatusPda] = getClaimStatusPda(faucetPubkey, userPubkey);

  try {
    const tx = await program.methods.resetSingleClaim(userPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        claimStatus: claimStatusPda,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to reset user claim");
  }
}

export async function updateSolanaFaucetConfig(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newAmount: number,
  newStartTime: number,
  newEndTime: number,
  newBackendSigner: string | null
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const backendSignerPubkey = newBackendSigner ? new PublicKey(newBackendSigner) : null;

  try {
    const tx = await program.methods.updateFaucetConfig(
      new BN(newAmount),
      new BN(newStartTime),
      new BN(newEndTime),
      backendSignerPubkey
    )
    .accounts({
      authority: wallet.publicKey,
      faucet: faucetPubkey,
    }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update config");
  }
}

export async function setSolanaPaused(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  paused: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const tx = await program.methods.setPaused(paused)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update pause status");
  }
}

export async function updateSolanaName(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newName: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const tx = await program.methods.updateName(newName)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update name");
  }
}

export async function transferSolanaAuthority(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newAuthority: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const newAuthorityPubkey = new PublicKey(newAuthority);

  try {
    const tx = await program.methods.transferAuthority(newAuthorityPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      }).rpc();
    return tx;
  } catch (error: any) {
    throw new Error(error.message || "Failed to transfer authority");
  }
}

/**
 * ==========================================
 * READ / FETCH DATA
 * ==========================================
 */
export async function getSolanaFaucetDetails(
  connection: Connection,
  faucetAddress: string
) {
  const dummyWallet = { 
    publicKey: PublicKey.default, 
    signTransaction: async () => {}, 
    signAllTransactions: async () => {} 
  };
  const program = getSolanaProgram(connection, dummyWallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const state = await program.account.faucetState.fetch(faucetPubkey);
    
    let vaultBalance = BigInt(0);
    try {
      const vaultAccount = await getAccount(connection, state.tokenVault);
      vaultBalance = vaultAccount.amount;
    } catch (e) {
      console.warn("Could not fetch vault balance (might be empty).");
    }

    return {
      faucetAddress,
      token: state.tokenMint.toString(),
      owner: state.authority.toString(),
      name: state.name,
      claimAmount: BigInt(state.claimAmount.toString()),
      startTime: Number(state.startTime.toString()),
      endTime: Number(state.endTime.toString()),
      isClaimActive: !state.paused,
      balance: vaultBalance,
      isEther: false, 
      backendMode: state.backendSigner.toString() !== PublicKey.default.toString(),
      faucetType: state.faucetType === 0 ? 'dropcode' : 'droplist', 
    };
  } catch (error: any) {
    console.error("❌ Error fetching Solana faucet details:", error);
    throw error;
  }
}

/**
 * Get claim status for a specific user on a faucet
 */
export async function getSolanaClaimStatus(
  connection: Connection,
  faucetAddress: string,
  userAddress: string
) {
  const program = getSolanaProgram(connection, { publicKey: PublicKey.default } as any); // dummy wallet for read-only
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [claimPda] = getClaimStatusPda(faucetPubkey, userPubkey);

  try {
    const status = await program.account.claimStatus.fetch(claimPda);
    return {
      claimed: status.claimed,
      amount: BigInt(status.amount.toString()),
      claimTime: Number(status.claimTime.toString()),
    };
  } catch (err: any) {
    // Account not found = not claimed
    if (err.message.includes("Account does not exist")) {
      return { claimed: false, amount: BigInt(0), claimTime: 0 };
    }
    throw err;
  }
}

/**
 * Check if user is whitelisted + get custom amount (if any)
 */
export async function getSolanaWhitelistEntry(
  connection: Connection,
  faucetAddress: string,
  userAddress: string
) {
  const program = getSolanaProgram(connection, { publicKey: PublicKey.default } as any);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const entry = await program.account.whitelistEntry.fetch(whitelistPda);
    return {
      isWhitelisted: entry.isWhitelisted,
      customAmount: BigInt(entry.customAmount.toString()),
    };
  } catch (err: any) {
    return { isWhitelisted: false, customAmount: BigInt(0) };
  }
}

/**
 * Quick check: is faucet paused?
 */
export async function isSolanaFaucetPaused(
  connection: Connection,
  faucetAddress: string
): Promise<boolean> {
  const details = await getSolanaFaucetDetails(connection, faucetAddress);
  return details.isClaimActive === false; // or directly fetch paused field if you prefer
}

/**
 * Batch add multiple users to the whitelist in one transaction
 * @param connection 
 * @param wallet 
 * @param faucetAddress 
 * @param entries Array of { userAddress: string, customAmount: number }
 */
export async function batchAddToSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  entries: { userAddress: string; customAmount: number }[]
): Promise<string> {
  if (entries.length === 0) throw new Error("No entries to add");

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  // Optional: Request more compute units (recommended for > 8–10 items)
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })
  );

  for (const { userAddress, customAmount } of entries) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    const ix = await program.methods
      .addToWhitelist(new BN(customAmount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  try {
    const signature = await program.provider.sendAndConfirm!(transaction);
    console.log(`Batch whitelist added (${entries.length} users). Tx:`, signature);
    return signature;
  } catch (error: any) {
    console.error("Batch add whitelist failed:", error);
    throw new Error(error.message || "Batch whitelist operation failed");
  }
}

/**
 * Batch remove multiple users from whitelist
 */
export async function batchRemoveFromSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddresses: string[]
): Promise<string> {
  if (userAddresses.length === 0) throw new Error("No users to remove");

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })
  );

  for (const userAddress of userAddresses) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    const ix = await program.methods
      .removeFromWhitelist()
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`Batch removed (${userAddresses.length} users). Tx:`, signature);
  return signature;
}

/**
 * Batch set custom claim amounts (for faucet_type === 2)
 */
export async function batchSetSolanaCustomClaimAmounts(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  entries: { userAddress: string; amount: number }[]
): Promise<string> {
  if (entries.length === 0) throw new Error("No entries");

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })
  );

  for (const { userAddress, amount } of entries) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    // Note: we reuse addToWhitelist instruction since it sets customAmount
    const ix = await program.methods
      .addToWhitelist(new BN(amount)) // same instruction sets custom amount
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`Batch custom amounts set (${entries.length} users). Tx:`, signature);
  return signature;
}

/**
 * Batch reset claim status for multiple users
 */
export async function batchResetSolanaClaims(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddresses: string[]
): Promise<string> {
  if (userAddresses.length === 0) throw new Error("No users to reset");

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })
  );

  for (const userAddress of userAddresses) {
    const userPubkey = new PublicKey(userAddress);
    const [claimStatusPda] = getClaimStatusPda(faucetPubkey, userPubkey);

    const ix = await program.methods
      .resetSingleClaim(userPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        claimStatus: claimStatusPda,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`Batch reset claims (${userAddresses.length} users). Tx:`, signature);
  return signature;
}