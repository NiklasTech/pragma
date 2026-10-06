import { create } from "zustand";

export type ReviewCommentSide = "old" | "new";

export interface ReviewComment {
  id: string;
  sessionId: string;
  path: string;
  side: ReviewCommentSide;
  line: number;
  code: string;
  body: string;
}

interface ReviewCommentsState {
  comments: ReviewComment[];
  addComment: (comment: Omit<ReviewComment, "id">) => void;
  updateComment: (id: string, body: string) => void;
  removeComment: (id: string) => void;
  clearSession: (sessionId: string) => void;
}

export const useReviewCommentsStore = create<ReviewCommentsState>()((set) => ({
  comments: [],
  addComment: (comment) =>
    set((state) => ({ comments: [...state.comments, { ...comment, id: crypto.randomUUID() }] })),
  updateComment: (id, body) =>
    set((state) => ({
      comments: state.comments.map((comment) =>
        comment.id === id ? { ...comment, body } : comment,
      ),
    })),
  removeComment: (id) =>
    set((state) => ({ comments: state.comments.filter((comment) => comment.id !== id) })),
  clearSession: (sessionId) =>
    set((state) => ({
      comments: state.comments.filter((comment) => comment.sessionId !== sessionId),
    })),
}));
