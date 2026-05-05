import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordSchema,
  profileSchema,
  signUpSchema,
} from "./auth.schemas";

describe(signUpSchema, () => {
  it("accepts valid signup data", () => {
    const result = signUpSchema.parse({
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
      signUpSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        confirm_password: "different",
      }),
    ).toThrow();
  });

  it("rejects email that is not a valid email", () => {
    expect(() =>
      signUpSchema.parse({
        name: "John Doe",
        email: "not-an-email",
        password: "password123",
        confirm_password: "password123",
      }),
    ).toThrow();
  });

  it("rejects name shorter than 3 characters", () => {
    expect(() =>
      signUpSchema.parse({
        name: "ab",
        email: "john@example.com",
        password: "password123",
        confirm_password: "password123",
      }),
    ).toThrow();
  });

  it("rejects password shorter than 8 characters", () => {
    expect(() =>
      signUpSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        password: "short",
        confirm_password: "short",
      }),
    ).toThrow();
  });
});

describe(loginSchema, () => {
  it("accepts valid login data", () => {
    const result = loginSchema.parse({
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
      loginSchema.parse({
        email: "invalid",
        password: "password123",
      }),
    ).toThrow();
  });

  it("rejects empty email", () => {
    expect(() =>
      loginSchema.parse({
        email: "",
        password: "password123",
      }),
    ).toThrow();
  });
});

describe(profileSchema, () => {
  it("accepts a name and a valid URL for image", () => {
    const result = profileSchema.parse({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    });
    expect(result).toEqual({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    });
  });

  it("accepts an empty string for image", () => {
    const result = profileSchema.parse({
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
      profileSchema.parse({
        name: "John Doe",
        image: "not-a-url",
      }),
    ).toThrow();
  });
});

describe(passwordSchema, () => {
  it("accepts valid password change data", () => {
    const result = passwordSchema.parse({
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
      passwordSchema.parse({
        currentPassword: "",
        newPassword: "newpass123",
      }),
    ).toThrow();
  });
});
