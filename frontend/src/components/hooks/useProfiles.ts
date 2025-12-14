import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "@/anchor-idl/idl.json";
import { SolanaInstagram } from "@/anchor-idl/idl";
import { getErrorMessage } from "@/lib/errors";
import { UserProfile } from "./useUserProfile";

export interface ProfileWithFollowStatus extends UserProfile {
  isFollowing: boolean;
  followPda: PublicKey | null;
}

export function useProfiles() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [profiles, setProfiles] = useState<ProfileWithFollowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

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

  // Derive PDA for follow relationship
  const deriveFollowPda = (follower: PublicKey, following: PublicKey): PublicKey => {
    return PublicKey.findProgramAddressSync([
      Buffer.from("follow"),
      follower.toBuffer(),
      following.toBuffer()
    ], PROGRAM_ID)[0];
  };

  const batchCheckFollowStatus = useCallback(async (
    profileAuthorities: PublicKey[]
  ): Promise<Map<string, { isFollowing: boolean; followPda: PublicKey | null }>> => {
    if (!wallet || !program) {
      return new Map();
    }

    // Derive all follow PDAs at once
    const followPdas: PublicKey[] = [];
    const authorityToFollowPda = new Map<string, PublicKey>();
    
    profileAuthorities.forEach((authority) => {
      const followPda = deriveFollowPda(wallet.publicKey, authority);
      followPdas.push(followPda);
      authorityToFollowPda.set(authority.toString(), followPda);
    });

    // Batch fetch all follow accounts in ONE RPC call
    const followAccounts = await connection.getMultipleAccountsInfo(followPdas);
    
    // Create result map
    const resultMap = new Map<string, { isFollowing: boolean; followPda: PublicKey | null }>();
    
    followAccounts.forEach((accountInfo, index) => {
      const followPda = followPdas[index];
      const authority = Array.from(authorityToFollowPda.entries()).find(
        ([_, pda]) => pda.equals(followPda)
      )?.[0];
      
      if (authority) {
        resultMap.set(authority, {
          isFollowing: accountInfo !== null,
          followPda: accountInfo ? followPda : null
        });
      }
    });

    return resultMap;
  }, [wallet, program, connection]);

  // Fetch all profiles with batch follow status check
  const fetchAllProfiles = useCallback(async () => {
    if (!program || !wallet) return;

    // Prevent duplicate calls
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all user profiles
      const allProfiles = await program.account.userProfile.all();
      
      // Filter out current user's profile
      const otherProfiles = allProfiles.filter(
        (profileAccount) => !profileAccount.account.authority.equals(wallet.publicKey)
      );

      // Extract all profile authorities
      const profileAuthorities = otherProfiles.map(
        (profileAccount) => profileAccount.account.authority
      );

      // Batch check follow status for ALL profiles at once
      const followStatusMap = await batchCheckFollowStatus(profileAuthorities);

      // Build profiles with follow status
      const profilesWithStatus: ProfileWithFollowStatus[] = otherProfiles.map((profileAccount) => {
        const profileData = profileAccount.account;
        const authorityKey = profileData.authority.toString();
        const followStatus = followStatusMap.get(authorityKey) || { 
          isFollowing: false, 
          followPda: null 
        };

        const userProfile: UserProfile = {
          authority: profileData.authority,
          handle: profileData.handle,
          bio: profileData.bio,
          avatarUri: profileData.avatarUri,
          followerCount: profileData.followerCount.toNumber(),
          followingCount: profileData.followingCount.toNumber(),
          createdAt: profileData.createdAt.toNumber(),
          updatedAt: profileData.updatedAt.toNumber(),
        };

        return {
          ...userProfile,
          isFollowing: followStatus.isFollowing,
          followPda: followStatus.followPda,
        };
      });

      setProfiles(profilesWithStatus);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching profiles:", err);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [program, wallet, batchCheckFollowStatus]);

  // Follow a user
  const followUser = async (profileAuthority: PublicKey) => {
    if (!program || !wallet) {
      throw new Error("Program or wallet not available");
    }

    try {
      // Derive PDAs
      const followPda = deriveFollowPda(wallet.publicKey, profileAuthority);
      const followerProfilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        wallet.publicKey.toBuffer()
      ], PROGRAM_ID)[0];
      const followingProfilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        profileAuthority.toBuffer()
      ], PROGRAM_ID)[0];

      // Call follow_user_profile instruction
      const tx = await program.methods
        .followUserProfile()
        .accounts({
          follower: wallet.publicKey,
          followerProfile: followerProfilePda,
          followingProfile: followingProfilePda,
        })
        .rpc();

      // Update local state
      await fetchAllProfiles();
      return { success: true, tx };
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.error?.errorCode?.code);
      return { success: false, error: errorMessage };
    }
  };

  // Unfollow a user
  const unfollowUser = async (profileAuthority: PublicKey) => {
    if (!program || !wallet) {
      throw new Error("Program or wallet not available");
    }

    try {
      // Derive PDAs
      const followPda = deriveFollowPda(wallet.publicKey, profileAuthority);
      const followerProfilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        wallet.publicKey.toBuffer()
      ], PROGRAM_ID)[0];
      const followingProfilePda = PublicKey.findProgramAddressSync([
        Buffer.from("profile"),
        profileAuthority.toBuffer()
      ], PROGRAM_ID)[0];

      // Call unfollow_user_profile instruction
      const tx = await program.methods
        .unfollowUserProfile()
        .accounts({
          follower: wallet.publicKey,
          followerProfile: followerProfilePda,
          followingProfile: followingProfilePda,
        })
        .rpc();

      // Update local state
      await fetchAllProfiles();
      return { success: true, tx };
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.error?.errorCode?.code);
      return { success: false, error: errorMessage };
    }
  };

  useEffect(() => {
    if (wallet && program) {
      fetchAllProfiles();
    } else {
      setProfiles([]);
    }
  }, [wallet, program, fetchAllProfiles]);

  return {
    profiles,
    isLoading,
    error,
    followUser,
    unfollowUser,
    refetch: fetchAllProfiles,
  };
}