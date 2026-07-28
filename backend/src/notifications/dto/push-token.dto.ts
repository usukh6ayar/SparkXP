import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  /**
   * Expo push token. Validated by shape so a malformed value can't be stored
   * and then silently fail on every send forever.
   */
  @IsString()
  @MaxLength(255)
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, {
    message: 'token нь ExponentPushToken[...] хэлбэртэй байх ёстой',
  })
  token: string;
}

export class PushPrefsDto {
  @IsBoolean()
  enabled: boolean;
}
