"use client"

import { useEffect, useState } from "react";
import { usePost } from "./hooks/usePost";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, User, Smile, Frown, Laugh, Zap, Angry } from "lucide-react";
import { Button } from "./ui/button";
import CommentDialog from "./CommentDialog";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";

interface PostData {
    account: {
        mediaUri: string;
        content: string;
        likeCount: any;
        dislikeCount: any;
        loveCount: any;
        hahaCount: any;
        wowCount: any;
        sadCount: any;
        angryCount: any;
        commentCount: any;
        createdAt: any;
        creator: any;
    };
    publicKey: any;
    creatorHandle?: string;
}

const HomePagePosts = () => {
    const { allPosts, isLoading, error, fetchAllPosts } = usePost();
    const [selectedPost, setSelectedPost] = useState<{ pda: PublicKey; creator: PublicKey } | null>(null);
    const [reactingPosts, setReactingPosts] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchPosts = async () => {
            await fetchAllPosts();
        }
        fetchPosts();
    }, []);


    const handleCommentClick = (postPda: PublicKey, postCreator: PublicKey) => {
        setSelectedPost({ pda: postPda, creator: postCreator });
    };

    const formatTimeAgo = (timestamp: any) => {
        const now = Date.now();
        const postTime = timestamp.toNumber() * 1000;
        const diffInSeconds = Math.floor((now - postTime) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds}s`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20 text-red-500">
                <p>Error loading posts: {error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-2xl mx-auto px-4 py-8">
                <div className="space-y-6">
                    {allPosts?.map((post: PostData, index: number) => {
                        const postPda = post.publicKey;
                        const isReacting = reactingPosts.has(postPda.toString());

                        return (
                            <div key={postPda.toString()} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                                {/* Post Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                                            <User className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900">
                                                {post.creatorHandle}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatTimeAgo(post.account.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Post Image */}
                                <div className="relative">
                                    <img
                                        src={post.account.mediaUri}
                                        alt="Post"
                                        className="w-full h-auto object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>

                                {/* Post Actions */}
                                <div className="p-4 space-y-3">
                                    {/* Reactions Row */}
                                    <div className="flex items-center space-x-1">

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-600"
                                            onClick={() => handleCommentClick(postPda, post.account.creator)}
                                        >
                                            <MessageCircle className="h-5 w-5" />
                                        </Button>
                                    </div>


                                    {/* Post Content */}
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-900">
                                            {post.account.content}
                                        </p>
                                    </div>

                                    {/* Comment Count */}
                                    <div
                                        className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
                                        onClick={() => handleCommentClick(postPda, post.account.creator)}
                                    >
                                        View all {post.account.commentCount.toNumber()} comments
                                    </div>

                                    {/* Timestamp */}
                                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                                        {formatTimeAgo(post.account.createdAt)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {allPosts.length === 0 && (
                        <div className="max-w-4xl mx-auto p-6 justify-center text-center">
                            <h1 className="text-3xl font-bold mb-6">Welcome to Solana Instagram</h1>
                            <p className="text-muted-foreground mb-6">
                                Share your moments on the blockchain. Create posts, connect with others, and explore the decentralized social experience.
                            </p>
                        </div>
                )}
            </div>

            {/* Comment Dialog */}
            {selectedPost && (
                <CommentDialog
                    isOpen={!!selectedPost}
                    onClose={() => setSelectedPost(null)}
                    postPda={selectedPost.pda}
                    postCreator={selectedPost.creator}
                />
            )}
        </>
    );
};

export default HomePagePosts;