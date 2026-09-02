import { describe, expect, it } from "vitest";

import { parse } from "../effect/schema.utils";
import {
  loginSchema,
  passwordSchema,
  profileSchema,
  signUpSchema,
} from "./auth.schemas";

describe("signUpSchema", () => {
  const VALID_PASSWORD = "Sup3r$ecretKey";

  it("accepts valid signup data", () => {
    const result = parse(signUpSchema)({
      name: "John Doe",
      email: "john@example.com",
      password: VALID_PASSWORD,
      confirm_password: VALID_PASSWORD,
    });
    expect(result).toEqual({
      name: "John Doe",
      email: "john@example.com",
      password: VALID_PASSWORD,
      confirm_password: VALID_PASSWORD,
    });
  });

  it("rejects when passwords do not match", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "john@example.com",
        password: VALID_PASSWORD,
        confirm_password: "Differ3nt$Key",
      }),
    ).toThrow();
  });

  it("rejects email that is not a valid email", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "not-an-email",
        password: VALID_PASSWORD,
        confirm_password: VALID_PASSWORD,
      }),
    ).toThrow();
  });

  it("rejects name shorter than 3 characters", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "ab",
        email: "john@example.com",
        password: VALID_PASSWORD,
        confirm_password: VALID_PASSWORD,
      }),
    ).toThrow();
  });

  it("rejects password shorter than 12 characters", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "john@example.com",
        password: "Ab1!678901",
        confirm_password: "Ab1!678901",
      }),
    ).toThrow();
  });

  it("rejects a long password without character-class diversity", () => {
    expect(() =>
      parse(signUpSchema)({
        name: "John Doe",
        email: "john@example.com",
        password: "abcdefghijkl",
        confirm_password: "abcdefghijkl",
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
  it("accepts a name, a valid URL for image and a username", () => {
    const result = parse(profileSchema)({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
      username: "john_doe",
    });
    expect(result).toEqual({
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
      username: "john_doe",
    });
  });

  it("accepts an empty string for image", () => {
    const result = parse(profileSchema)({
      name: "John Doe",
      image: "",
      username: "john_doe",
    });
    expect(result).toEqual({
      name: "John Doe",
      image: "",
      username: "john_doe",
    });
  });

  it("rejects an invalid username", () => {
    expect(() =>
      parse(profileSchema)({
        name: "John Doe",
        image: "",
        username: "Not Valid!",
      }),
    ).toThrow();
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
      newPassword: "N3w-Sup3rSecret",
    });
    expect(result).toEqual({
      currentPassword: "oldpass123",
      newPassword: "N3w-Sup3rSecret",
    });
  });

  it("rejects empty current password", () => {
    expect(() =>
      parse(passwordSchema)({
        currentPassword: "",
        newPassword: "N3w-Sup3rSecret",
      }),
    ).toThrow();
  });

  it("rejects a weak new password", () => {
    expect(() =>
      parse(passwordSchema)({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      }),
    ).toThrow();
  });
});
