import { IsString, IsIn, IsOptional, MinLength, MaxLength } from 'class-validator';
import { AuthProvider } from '../../common/enums';
import { IsUsername } from '../../common/validation/username';

/** Body for POST /api/auth/social — the token the provider gave the app. */
export class SocialSignInDto {
  @IsIn([AuthProvider.GOOGLE, AuthProvider.APPLE], {
    message: 'Дэмжигдээгүй нэвтрэлтийн төрөл',
  })
  provider: AuthProvider;

  /**
   * The provider's **identity token** (a JWT), not an access token. Verified
   * against the provider's JWKS in `SocialTokenService` — the server trusts
   * nothing in it until then.
   */
  @IsString()
  @MinLength(20)
  // Apple/Google id tokens sit well under this; the cap just stops a huge body
  // from reaching the JWT decoder.
  @MaxLength(8192)
  idToken: string;
}

/** Body for POST /api/auth/social/complete — finish a paused sign-up. */
export class SocialCompleteDto {
  /** The opaque ticket returned by `POST /auth/social` with needsUsername. */
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  ticket: string;

  /** The handle the user chose. Never derived from their email server-side. */
  @IsUsername()
  username: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;
}
