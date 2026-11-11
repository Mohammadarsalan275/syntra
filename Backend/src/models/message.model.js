import mongoose from "mongoose";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["text", "search", "image", "file"],
      default: "text",
    },
    citations: [
      {
        type: String,
      },
    ],
    sources: [
      {
        type: String,
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        type: String,
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("messageModel", messageSchema);