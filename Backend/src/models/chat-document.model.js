import mongoose from "mongoose";

const { Schema } = mongoose;

const chatDocumentSchema = new Schema(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "chatModel",
      required: true,
      index: true,
    },
    ownerUser: {
      type: Schema.Types.ObjectId,
      ref: "userModel",
      index: true,
    },
    ownerGuestId: {
      type: String,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
      select: false,
    },
    extractedText: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

chatDocumentSchema.pre("validate", function () {
  if (!this.ownerUser && !this.ownerGuestId) {
    this.invalidate("ownerUser", "A document must belong to a user or guest session.");
  }
  if (this.ownerUser && this.ownerGuestId) {
    this.invalidate("ownerGuestId", "A document cannot have both user and guest owners.");
  }
});

export default mongoose.model("chatDocumentModel", chatDocumentSchema);
