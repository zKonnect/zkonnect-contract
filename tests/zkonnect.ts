import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Zkonnect } from "../target/types/zkonnect";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

// Import the assertion library
import { assert } from "chai";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("zkonnect", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.zkonnect as Program<Zkonnect>;

  const isToken2022 = async (mint: PublicKey) => {
    const mintInfo = await provider.connection.getAccountInfo(mint);
    return mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID);
  };

  const getCreatorInfo = async (eventId: PublicKey) => {
    if (!program) {
      throw new Error("Program not initialized");
    }
    return program.account.event.fetch(eventId);
  };

  const wallet = provider.wallet as NodeWallet;

  const creator = anchor.web3.Keypair.generate();
  const buyer = anchor.web3.Keypair.generate();

  let merkleTree = anchor.web3.Keypair.generate().publicKey;
  let collection: anchor.web3.PublicKey;
  let mint: anchor.web3.PublicKey;
  let creatorAta: anchor.web3.PublicKey;
  let buyerAta: anchor.web3.PublicKey;
  let solProfilePda: PublicKey;
  let tokenProfilePda: PublicKey;

  it("Airdrop Sol to maker and taker", async () => {
    const tx = await provider.connection.requestAirdrop(
      creator.publicKey,
      (10000 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(tx);

    const tx2 = await provider.connection.requestAirdrop(
      buyer.publicKey,
      (10000 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(tx2);
  });

  it("Create tokens and Mint Tokens", async () => {
    mint = await createMint(
      provider.connection as any,
      wallet.payer,
      provider.publicKey,
      provider.publicKey,
      6
    );

    creatorAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection as any,
        wallet.payer,
        mint,
        creator.publicKey
      )
    ).address;

    buyerAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection as any,
        wallet.payer,
        mint,
        buyer.publicKey
      )
    ).address;

    const mintAmount = 10 * 10 ** 6;

    await mintTo(
      provider.connection as any,
      wallet.payer,
      mint,
      buyerAta,
      wallet.payer,
      mintAmount
    );

    const buyerBalance = await provider.connection.getTokenAccountBalance(
      buyerAta
    );

    assert.ok(buyerBalance.value.uiAmount === mintAmount / 10 ** 6);
  });

  it("Create a new Collection", async () => {
    collection = await createMint(
      provider.connection as any,
      wallet.payer,
      provider.publicKey,
      provider.publicKey,
      6
    );
  });

  it("Create a New Sol Event", async () => {
    const tokenProgram = (await isToken2022(mint))
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    await program.methods
      .createEvent(
        "Event 1",
        "Event 1 Description",
        "banner.jpg",
        "nfturi",
        new BN(100),
        100,
        0
      )
      .accounts({
        creator: creator.publicKey,
        mint: mint,
        tokenProgram: tokenProgram,
        merkleTree: merkleTree,
        collectionNft: collection,
      })
      .signers([creator])
      .rpc();
  });

  it("Create a New Token Event", async () => {
    const tokenProgram = (await isToken2022(mint))
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    await program.methods
      .createEvent(
        "Event 2",
        "Event 2 Description",
        "banner.jpg",
        "nfturi",
        new BN(100),
        100,
        1
      )
      .accounts({
        creator: creator.publicKey,
        mint: mint,
        tokenProgram: tokenProgram,
        merkleTree: merkleTree,
        collectionNft: collection,
      })
      .signers([creator])
      .rpc();
  });

  it("Search for Event", async () => {

    [solProfilePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("zkonnect"),
        creator.publicKey.toBuffer(),
        Buffer.from(utf8.encode("Event 1")),
      ],
      program.programId,
    );

    [tokenProfilePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("zkonnect"),
        creator.publicKey.toBuffer(),
        Buffer.from(utf8.encode("Event 2")),
      ],
      program.programId,
    );

    const createdSolEvent = await getCreatorInfo(solProfilePda);

    assert.ok(createdSolEvent.eventName === "Event 1");
    assert.ok(createdSolEvent.eventDescription === "Event 1 Description");
    assert.ok(createdSolEvent.banner === "banner.jpg");
    assert.ok(createdSolEvent.nfturi === "nfturi");
    assert.ok(createdSolEvent.ticketPrice.eq(new BN(100)));
    assert.ok(createdSolEvent.totalTickets === 100);
    assert.ok(createdSolEvent.paySol === 0);

    const createdTokenEvent = await getCreatorInfo(tokenProfilePda);
    assert.ok(createdTokenEvent.eventName === "Event 2");
    assert.ok(createdTokenEvent.eventDescription === "Event 2 Description");
    assert.ok(createdTokenEvent.banner === "banner.jpg");
    assert.ok(createdTokenEvent.nfturi === "nfturi");
    assert.ok(createdTokenEvent.ticketPrice.eq(new BN(100)));
    assert.ok(createdTokenEvent.totalTickets === 100);
    assert.ok(createdTokenEvent.paySol === 1);
  });

  it("Buy Ticket With Sol For SolEvent", async () => {

    // Check ticket count before buying
    const ticketCountBefore = await getCreatorInfo(solProfilePda);
    assert.ok(ticketCountBefore.totalTickets === 100);

    await program.methods
      .paySolForTicket()
      .accountsPartial({
        from: buyer.publicKey,
        to: creator.publicKey,
        event: solProfilePda,
      })
      .signers([buyer])
      .rpc();

    // Check ticket count after buying
    const ticketCountAfter = await getCreatorInfo(solProfilePda);
    assert.ok(ticketCountAfter.totalTickets === 99);
  });

  it("Cannot Buy Ticket With Token For SolEvent", async () => {
    const tokenProgram = (await isToken2022(mint))
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    try {
      await program.methods
        .payForTicket()
        .accountsPartial({
          from: buyer.publicKey,
          to: creator.publicKey,
          event: solProfilePda,
          tokenProgram,
          fromAta: buyerAta,
          toAta: creatorAta,
          mint: mint,
        })
        .signers([buyer])
        .rpc();
    } catch (error) {
      assert.ok(error.toString().includes("Error Message: Only SOL is accepted"));
    }
  });

  it("Buy Ticket With Token For TokenEvent", async () => {
    const tokenProgram = (await isToken2022(mint))
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    // Check ticket count before buying
    const ticketCountBefore = await getCreatorInfo(tokenProfilePda);
    assert.ok(ticketCountBefore.totalTickets === 100);

    await program.methods
      .payForTicket()
      .accountsPartial({
        from: buyer.publicKey,
        to: creator.publicKey,
        event: tokenProfilePda,
        tokenProgram,
        fromAta: buyerAta,
        toAta: creatorAta,
        mint: mint,
      })
      .signers([buyer])
      .rpc();

    // Check ticket count after buying
    const ticketCountAfter = await getCreatorInfo(tokenProfilePda);
    assert.ok(ticketCountAfter.totalTickets === 99);
  });

  it("Cannot Buy Ticket With Sol For TokenEvent", async () => {
    try {
      await program.methods
        .paySolForTicket()
        .accountsPartial({
          from: buyer.publicKey,
          to: creator.publicKey,
          event: tokenProfilePda,
        })
        .signers([buyer])
        .rpc();
    } catch (error) {
      assert.ok(error.toString().includes("Error Message: Pay Sol not enabled"));
    }
  });
  
});
