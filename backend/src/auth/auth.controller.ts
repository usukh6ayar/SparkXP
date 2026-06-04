import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/** Auth endpoints under /api/auth. */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Create an account and return a token. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Log in with email + password, return a token. */
  @Post('login')
  @HttpCode(200) // login isn't "creating" a resource, so 200 not 201
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Return the current user. Requires a valid Bearer token. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.toPublicUser(user);
  }
}
