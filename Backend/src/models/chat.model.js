import mongoose from "mongoose";

const { Schema } = mongoose;

const chatSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
      maxlength: 120,
    },
    chatType: {
      type: String,
      enum: ["chat", "search", "research"],
      default: "chat",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    model: {
      type: String,
      default: "gpt-4o-mini",
    },
    summary: {
      type: String,
      default: "",
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("chatModel", chatSchema);