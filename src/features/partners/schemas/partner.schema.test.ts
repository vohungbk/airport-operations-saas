import { describe, expect, it } from "vitest";

import {
  createPartnerSchema,
  deactivatePartnerSchema,
  updatePartnerSchema,
} from "@/features/partners/schemas/partner.schema";

const VALID_CREATE_INPUT = {
  name: "Emirates Rent A Car",
  code: "ERAC",
  contact_email: "ops@erac.example.com",
  status: "active",
};

describe("createPartnerSchema", () => {
  it("should parse a valid input", () => {
    const result = createPartnerSchema.safeParse(VALID_CREATE_INPUT);

    expect(result.success).toBe(true);
  });

  it("should default status to 'pending' when omitted", () => {
    const withoutStatus: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutStatus.status;
    const result = createPartnerSchema.safeParse(withoutStatus);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
    }
  });

  it("should reject a missing name", () => {
    const withoutName: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutName.name;
    const result = createPartnerSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });

  it("should reject a missing code", () => {
    const withoutCode: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutCode.code;
    const result = createPartnerSchema.safeParse(withoutCode);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid contact_email", () => {
    const result = createPartnerSchema.safeParse({
      ...VALID_CREATE_INPUT,
      contact_email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing contact_email", () => {
    const withoutEmail: Record<string, unknown> = { ...VALID_CREATE_INPUT };
    delete withoutEmail.contact_email;
    const result = createPartnerSchema.safeParse(withoutEmail);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid status", () => {
    const result = createPartnerSchema.safeParse({
      ...VALID_CREATE_INPUT,
      status: "not-a-status",
    });

    expect(result.success).toBe(false);
  });

  it("should trim whitespace from name and code", () => {
    const result = createPartnerSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "  Emirates Rent A Car  ",
      code: "  ERAC  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Emirates Rent A Car");
      expect(result.data.code).toBe("ERAC");
    }
  });
});

describe("updatePartnerSchema", () => {
  const VALID_UPDATE_INPUT = {
    name: "Emirates Rent A Car",
    contact_email: "ops@erac.example.com",
    status: "active",
  };

  it("should parse a valid input", () => {
    const result = updatePartnerSchema.safeParse(VALID_UPDATE_INPUT);

    expect(result.success).toBe(true);
  });

  it("should not have a code field, even when one is provided in the raw input", () => {
    const result = updatePartnerSchema.safeParse({
      ...VALID_UPDATE_INPUT,
      code: "SHOULD-BE-IGNORED",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("code");
    }
  });

  it("should reject a missing name", () => {
    const withoutName: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutName.name;
    const result = updatePartnerSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid contact_email", () => {
    const result = updatePartnerSchema.safeParse({
      ...VALID_UPDATE_INPUT,
      contact_email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing status", () => {
    const withoutStatus: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutStatus.status;
    const result = updatePartnerSchema.safeParse(withoutStatus);

    expect(result.success).toBe(false);
  });

  it("should reject an invalid status", () => {
    const result = updatePartnerSchema.safeParse({
      ...VALID_UPDATE_INPUT,
      status: "not-a-status",
    });

    expect(result.success).toBe(false);
  });
});

describe("deactivatePartnerSchema", () => {
  it("should parse a valid uuid partner_id", () => {
    const result = deactivatePartnerSchema.safeParse({
      partner_id: "b0000000-0000-0000-0000-000000000001",
    });

    expect(result.success).toBe(true);
  });

  it("should reject an empty partner_id", () => {
    const result = deactivatePartnerSchema.safeParse({ partner_id: "" });

    expect(result.success).toBe(false);
  });

  it("should reject a missing partner_id", () => {
    const result = deactivatePartnerSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
