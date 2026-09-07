import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { DataTokenStatusDto } from './dto/data-token-status.dto';
import { DataTokenCreatedDto } from './dto/data-token-created.dto';
import { DashboardDataQueryDto } from './dto/dashboard-data-query.dto';
import { DashboardDataResponseDto } from './dto/dashboard-data-response.dto';
import { DATA_TOKEN_HEADER } from './reports.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('data-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Whether the caller already has a 'export and connect' data token",
  })
  getTokenStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DataTokenStatusDto> {
    return this.reportsService.getTokenStatus(user);
  }

  @Post('data-token')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate (or regenerate) the data token backing /reports/dashboard-data; raw value shown once',
  })
  generateToken(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DataTokenCreatedDto> {
    return this.reportsService.generateToken(user);
  }

  @Delete('data-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the data token' })
  revokeToken(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.reportsService.revokeToken(user);
  }

  @Get('dashboard-data')
  @Public()
  @ApiHeader({
    name: DATA_TOKEN_HEADER,
    required: false,
    description:
      'The data token, for callers that can set headers. Preferred over ?token=, which keeps a credential in the URL; the header wins when both are sent.',
  })
  @ApiOperation({
    summary:
      "Aggregated dashboard metrics as JSON, gated by the data token in X-Data-Token or ?token= — meant for Power BI's Web connector or Looker Studio, not the session JWT",
  })
  getDashboardData(
    @Query() query: DashboardDataQueryDto,
    @Headers(DATA_TOKEN_HEADER) headerToken?: string,
  ): Promise<DashboardDataResponseDto> {
    return this.reportsService.getDashboardData(query, headerToken);
  }
}
