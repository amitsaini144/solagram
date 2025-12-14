"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { UploadButton } from "@/utils/uploadthing";
import { toast } from "sonner";
import { usePost, Post } from "./hooks/usePost";

export function CreatePostDialog({ refetchAllPosts }: { refetchAllPosts: () => Promise<void> }) {
    const [caption, setCaption] = useState("");
    const [imageUri, setImageUri] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const { createPost } = usePost();


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!imageUri.trim()) {
            toast.error("Please upload an image");
            return;
        }

        if (!caption.trim()) {
            toast.error("Please add a caption");
            return;
        }

        setIsLoading(true);

        try {
            const result = await createPost(imageUri, caption);
            if (!result.success) {
                toast.error(result?.error || "Failed to create post");
                return;
            }

            toast.success("Post created successfully!");
            setIsOpen(false);
            setCaption("");
            setImageUri("");

            await refetchAllPosts();

        } catch (error: any) {
            toast.error(`Failed to create post: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = (res: any) => {
        if (res && res[0]) {
            setImageUri(res[0].url);
            toast.success("Image uploaded successfully!");
        }
        setIsUploading(false);
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setCaption("");
            setImageUri("");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="text-primary-foreground hover:bg-primary/90 px-4 py-2 font-medium bg-black/80 dark:bg-white">
                    ➕ Post
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Post</DialogTitle>
                    <DialogDescription>
                        Upload an image and add a caption to create your post.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Image</Label>
                            <div className="flex flex-col items-center gap-4">
                                {imageUri ? (
                                    <img
                                        src={imageUri}
                                        alt="Post"
                                        className="w-80 h-60 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-80 h-60 rounded-lg bg-gray-200 flex items-center justify-center">
                                        <p className="text-gray-500 text-sm text-center">No image selected</p>
                                    </div>
                                )}
                                <UploadButton
                                    endpoint="imageUploader"
                                    onClientUploadComplete={handleImageUpload}
                                    onUploadError={(error: Error) => {
                                        toast.error(`Upload failed: ${error.message}`);
                                        setIsUploading(false);
                                    }}
                                    onUploadBegin={() => setIsUploading(true)}
                                    appearance={{
                                        button: "bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 text-sm font-medium disabled:opacity-50"
                                    }}
                                    content={{
                                        button: isUploading ? "Uploading..." : "Upload Image"
                                    }}
                                    disabled={isUploading}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="caption">Caption</Label>
                            <Textarea
                                id="caption"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="What's on your mind?"
                                maxLength={500}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading || !imageUri || !caption.trim()}>
                            {isLoading ? "Creating..." : "Create Post"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}