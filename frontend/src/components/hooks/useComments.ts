import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "@/anchor-idl/idl.json";
import { SolanaInstagram } from "@/anchor-idl/idl";
import crypto from "crypto";
import { getErrorMessage } from "@/lib/errors";
import { useUserProfile } from "./useUserProfile";

export interface Comment {
  post: PublicKey;
  commentBy: PublicKey;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export function useComments() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profilePda } = useUserProfile();
  const fetchingRef = useRef<string | null>(null); // Track which post is being fetched

  // Program ID from your Anchor.toml
  const PROGRAM_ID = new PublicKey("o7WMnMvBfhf21mXMeoi2yAdmfiCsEaKGZE3DHT1E1qF");

  // Create Anchor provider
  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
  }, [connection, wallet]);

  // Create program instance
  const program = useMemo(() => {
    if (!provider) return null;
    return new Program<SolanaInstagram>(idl as SolanaInstagram, provider);
  }, [provider]);

  // Derive PDA for comment
  const deriveCommentPda = (postPda: PublicKey, content: string): PublicKey | null => {
    if (!wallet) return null;
    return PublicKey.findProgramAddressSync([
      Buffer.from("comment"),
      postPda.toBuffer(),
      wallet.publicKey.toBuffer(),
      crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest().slice(0, 4)
    ], PROGRAM_ID)[0];
  };

  // Add comment to a post
  const addComment = async (postPda: PublicKey, content: string) => {
    if (!program || !wallet || !profilePda) {
      throw new Error("Program, wallet, or profile not available");
    }

    try {
      const commentPda = deriveCommentPda(postPda, content);
      if (!commentPda) {
        throw new Error("Failed to derive comment PDA");
      }

      const tx = await program.methods
        .createComment(content)
        .accounts({
          commenter: wallet.publicKey,
          comment: commentPda,
          post: postPda,
        })
        .rpc();

      // Refresh comments for this post
      await fetchCommentsForPost(postPda);
      return { success: true, tx };
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.error?.errorCode?.code);
      return { success: false, error: errorMessage };
    }
  };

  // OPTIMIZED: Fetch comments with duplicate call prevention
  const fetchCommentsForPost = useCallback(async (postPda: PublicKey) => {
    if (!program) return;

    const postKey = postPda.toString();
    
    // Prevent duplicate calls for the same post
    if (fetchingRef.current === postKey) {
      return;
    }

    fetchingRef.current = postKey;
    setIsLoading(true);
    setError(null);

    try {
      // 1 RPC call: Fetch all comments for this post
      const postComments = await program.account.comment.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: postPda.toBase58()
          }
        }
      ]);

      // Convert to our interface format
      const commentsList: Comment[] = postComments.map((commentAccount) => {
        const commentData = commentAccount.account;
        return {
          post: commentData.post,
          commentBy: commentData.commentBy,
          content: commentData.content,
          createdAt: commentData.createdAt.toNumber(),
          updatedAt: commentData.updatedAt.toNumber(),
        };
      });

      // Sort by creation time (oldest first)
      commentsList.sort((a, b) => a.createdAt - b.createdAt);
      setComments(commentsList);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching comments:", err);
    } finally {
      setIsLoading(false);
      fetchingRef.current = null;
    }
  }, [program]);

  return {
    comments,
    isLoading,
    error,
    addComment,
    fetchCommentsForPost,
  };
}