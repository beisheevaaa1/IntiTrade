import { SupportTicketCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { supportMessageSchema, supportTicketSchema } from "./routes/support.js";

describe("support ticket validation", () => {
  it("accepts a complete support request", () => {
    expect(supportTicketSchema.safeParse({
      subject: "Unable to publish a listing",
      description: "The publish button returns an error after I add photos.",
      category: SupportTicketCategory.LISTING
    }).success).toBe(true);
  });

  it("rejects short or unsupported ticket input", () => {
    expect(supportTicketSchema.safeParse({ subject: "Hi", description: "Short", category: "BILLING" }).success).toBe(false);
  });

  it("bounds conversation messages", () => {
    expect(supportMessageSchema.safeParse({ body: "Here are the steps I tried." }).success).toBe(true);
    expect(supportMessageSchema.safeParse({ body: "x" }).success).toBe(false);
    expect(supportMessageSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });
});
