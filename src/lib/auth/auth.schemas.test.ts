import { describe, expect, it } from "vitest";

import { parse } from "../effect/schema.utils";
import {
  loginSchema,
  passwordSchema,
  profileSchema,
  signUpSchema,
} from "./auth.schemas";

describe("signUpSchema", () => {
  it("accepts valid signup data", () => {
    const result = parse(signUpSchema)({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      confirm_password: "password123",
    });
    expect(result).toEqual({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      confirm_password: "password123",
    });
  });

  it("rejects when passwords do not match", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        confirm_password: "different",
      }),
    ).toThrow();
  });

  it("rejects email that is not a valid email", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "not-an-email",
        password: "password123",
        confirm_password: "password123",
      }),
    ).toThrow();
  });

  it("rejects name shorter than 3 characters", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "ab",
        email: "john@example.com",
        password: "password123",
        confirm_password: "password123",
      }),
    ).toThrow();
  });

  it("rejects password shorter than 8 characters", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "john@example.com",
        password: "short",
        confirm_password: "short",
      }),
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = parse(loginSchema)({
      email: "john@example.com",
      password: "password123",
    });
    expect(result).toEqual({
      email: "john@example.com",
      password: "password123",
    });
  });

  it("rejects invalid email", () => {
    expect(() =>
      parse(loginSchema)({
        email: "invalid",
        password: "password123",
      }),
    ).toThrow();
  });

  it("rejects empty email", () => {
    expect(() =>
      parse(loginSchema)({
        email: "",
        password: "password123",
      }),
    ).toThrow();
  });
});

describe("profileSchema", () => {
  it("accepts a name and a valid URL for image", () => {
    const result = parse(profileSchema)({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    });
    expect(result).toEqual({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    });
  });

  it("accepts an empty string for image", () => {
    const result = parse(profileSchema)({
      name: "John Doe",
      image: "",
    });
    expect(result).toEqual({
      name: "John Doe",
      image: "",
    });
  });

  it("rejects an invalid URL for image", () => {
    expect(() =>
      parse(profileSchema)({
        name: "John Doe",
        image: "not-a-url",
      }),
    ).toThrow();
  });
});

describe("passwordSchema", () => {
  it("accepts valid password change data", () => {
    const result = parse(passwordSchema)({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
    });
    expect(result).toEqual({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
    });
  });

  it("rejects empty current password", () => {
    expect(() =>
      parse(passwordSchema)({
        currentPassword: "",
        newPassword: "newpass123",
      }),
    ).toThrow();
  });
});
