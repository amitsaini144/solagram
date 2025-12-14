import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "@/anchor-idl/idl.json";
import { SolanaInstagram } from "@/anchor-idl/idl";
import crypto from "crypto";
import { getErrorMessage } from "@/lib/errors";
import { useUserProfile } from "./useUserProfile";

export interface Post {
    profile: PublicKey,
    creator: PublicKey,
    content: string,
    media_uri: string,
    like_count: number,
    dislike_count: number,
    love_count: number,
    haha_count: number,
    wow_count: number,
    sad_count: number,
    angry_count: number,
    comment_count: number,
    created_at: number,
    updated_at: number,
    creator_handle?: string,
}

export function usePost() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const [post, setPost] = useState<Post | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [posts, setPosts] = useState([]);
    const [allPosts, setAllPosts] = useState([]);
    const { profilePda } = useUserProfile();
    const fetchingRef = useRef(false);

    const PROGRAM_ID = new PublicKey("o7WMnMvBfhf21mXMeoi2yAdmfiCsEaKGZE3DHT1E1qF");

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

    // Derive PDA for post (utility function)
    const derivePostPda = (mediaUri: string, profilePda: PublicKey): PublicKey | null => {
        if (!wallet) return null;
        return PublicKey.findProgramAddressSync([
            Buffer.from("post"),
            wallet.publicKey.toBuffer(),
            crypto.createHash('sha256').update(Buffer.from(mediaUri, 'utf8')).digest().slice(0, 4),
            profilePda.toBuffer()
        ], PROGRAM_ID)[0];
    };

    // Create post function
    const createPost = async (mediaUri: string, content: string) => {
        if (!program || !wallet || !profilePda) {
            throw new Error("Program or wallet not available");
        }

        try {
            // Derive PDA for post
            const postPda = derivePostPda(mediaUri, profilePda);
            if (!postPda) {
                throw new Error("Failed to derive post PDA");
            }

            // Create the post
            const tx = await program.methods
                .createPost(mediaUri, content)
                .accounts({
                    creator: wallet.publicKey,
                    post: postPda,
                    profile: profilePda,
                })
                .rpc();

            return { success: true, tx };
        } catch (err: any) {
            const errorMessage = getErrorMessage(err.error?.errorCode?.code);
            return { success: false, error: errorMessage };
        }
    };

    // Fetch post data by PDA
    const fetchPost = async (mediaUri: string) => {
        if (!program || !profilePda) return;

        try {
            const postPda = derivePostPda(mediaUri, profilePda);
            if (!postPda) {
                throw new Error("Failed to derive post PDA");
            }

            const postAccount = await program.account.post.fetch(postPda);

            // Convert the account data to our interface format
            const userPost: Post = {
                profile: postAccount.profile,
                creator: postAccount.creator,
                content: postAccount.content,
                media_uri: postAccount.mediaUri,
                like_count: postAccount.likeCount.toNumber(),
                dislike_count: postAccount.dislikeCount.toNumber(),
                love_count: postAccount.loveCount.toNumber(),
                haha_count: postAccount.hahaCount.toNumber(),
                wow_count: postAccount.wowCount.toNumber(),
                sad_count: postAccount.sadCount.toNumber(),
                angry_count: postAccount.angryCount.toNumber(),
                comment_count: postAccount.commentCount.toNumber(),
                created_at: postAccount.createdAt.toNumber(),
                updated_at: postAccount.updatedAt.toNumber(),
            };

            setPost(userPost);
            return userPost;
        } catch (err: any) {
            const errorMessage = getErrorMessage(err.error?.errorCode?.code);
            return { success: false, error: errorMessage };
        }
    };

    const fetchAllUserPosts = async () => {
        if (!program || !wallet || !profilePda) return;

        try {
            const userPosts = await program.account.post.all([
                {
                    memcmp: {
                        offset: 8,
                        bytes: profilePda.toBase58()
                    }
                }
            ]);
            setPosts(userPosts as unknown as any);
        } catch (err: any) {
            const errorMessage = getErrorMessage(err.error?.errorCode?.code);
            setError(errorMessage);
        }
    }

    const fetchAllPosts = useCallback(async () => {
        if (!program || !wallet) {
            return;
        }

        // Prevent duplicate calls
        if (fetchingRef.current) {
            return;
        }

        fetchingRef.current = true;
        setIsLoading(true);

        try {
            // Fetch all posts in one call
            const allPostsResponse = await program.account.post.all();

            // Get unique creators to avoid duplicate profile fetches
            const uniqueCreators = new Map<string, PublicKey>();
            allPostsResponse.forEach((post: any) => {
                const creatorKey = post.account.creator.toString();
                if (!uniqueCreators.has(creatorKey)) {
                    uniqueCreators.set(creatorKey, post.account.creator);
                }
            });

            // Derive all profile PDAs
            const profilePdas: PublicKey[] = [];
            const creatorToPda = new Map<string, PublicKey>();

            uniqueCreators.forEach((creator) => {
                const creatorProfilePda = PublicKey.findProgramAddressSync([
                    Buffer.from("profile"),
                    creator.toBuffer()
                ], PROGRAM_ID)[0];
                profilePdas.push(creatorProfilePda);
                creatorToPda.set(creator.toString(), creatorProfilePda);
            });

            // Batch fetch all profiles in one RPC call
            const profileAccounts = await connection.getMultipleAccountsInfo(profilePdas);

            // Create a map of profile PDA to handle
            const profileMap = new Map<string, string>();
            profileAccounts.forEach((accountInfo, index) => {
                if (accountInfo) {
                    try {
                        // Decode the account data
                        const profileData = program.coder.accounts.decode(
                            "userProfile",
                            accountInfo.data
                        );
                        const pda = profilePdas[index];
                        const creator = Array.from(creatorToPda.entries()).find(
                            ([_, pdaKey]) => pdaKey.equals(pda)
                        )?.[0];
                        if (creator) {
                            profileMap.set(creator, profileData.handle);
                        }
                    } catch (err) {
                        // Profile decode failed, will use fallback
                    }
                }
            });

            // Map posts with handles
            const postsWithHandles = allPostsResponse.map((post: any) => {
                const creatorKey = post.account.creator.toString();
                const handle = profileMap.get(creatorKey) || `User ${creatorKey.slice(0, 8)}...`;

                return {
                    ...post,
                    creatorHandle: handle
                };
            });

            const sortedPosts = postsWithHandles.sort((a: any, b: any) => {
                return (
                    Number(b.account.createdAt) - Number(a.account.createdAt)
                );
            });

            setAllPosts(sortedPosts as unknown as any);
        } catch (err: any) {
            console.error("Error fetching posts:", err);
            setError(err.message || "Failed to fetch posts");
        } finally {
            setIsLoading(false);
            fetchingRef.current = false;
        }
    }, [program, wallet, connection]);


    const deletePost = async (mediaUri: string) => {
        if (!program || !wallet || !profilePda) return;

        const postPda = derivePostPda(mediaUri, profilePda);
        if (!postPda) {
            throw new Error("Failed to derive post PDA");
        }

        try {
            const tx = await program.methods
                .deleteUserPost()
                .accounts({
                    creator: wallet?.publicKey,
                    post: postPda,
                })
                .rpc();
            return { success: true, tx };
        } catch (err: any) {
            const errorMessage = getErrorMessage(err.error?.errorCode?.code);
            console.log("errorMessage", errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    return {
        post,
        posts,
        allPosts,
        isLoading,
        error,
        createPost,
        fetchPost,
        derivePostPda,
        refetchAllPosts: fetchAllUserPosts,
        deletePost,
        fetchAllPosts,
    };
}