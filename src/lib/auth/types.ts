/** Provider-independent authentication models used by the application. */
export type AuthenticatedUser = {
  readonly createdAt: Date;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
  readonly role: string;
  readonly twoFactorEnabled: boolean;
  readonly updatedAt: Date;
  readonly username: string;
};

export type AuthSession = {
  readonly session: {
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly id: string;
    readonly ipAddress: string | null;
    readonly token: string;
    readonly updatedAt: Date;
    readonly userAgent: string | null;
    readonly userId: string;
  };
  readonly user: AuthenticatedUser;
};
