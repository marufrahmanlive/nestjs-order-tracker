import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import {
  CreateProductDto,
  PRODUCT_PATTERNS,
  SERVICES,
  ServiceResponse,
  IProduct,
  Public,
  Roles,
} from '@app/common';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(SERVICES.PRODUCT)
    private readonly productClient: ClientProxy,

    @InjectPinoLogger(ProductsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @ApiOperation({
    summary: 'Create a new product',
    description: 'Admin only. Creates a new product in the catalog.',
  })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid JWT',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — requires admin role' })
  @ApiBearerAuth('access-token')
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateProductDto) {
    this.logger.info(
      { body: dto },
      'POST /products — forwarding to Product Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Product creation failed');
      throw new HttpException(
        response.error || 'Failed to create product',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { productId: response.data?._id },
      'Product created successfully via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'List all products',
    description: 'Public endpoint. Returns all products (uses Redis cache).',
  })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Public()
  @Get()
  async findAll() {
    this.logger.info('GET /products — forwarding to Product Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IProduct[]>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Failed to fetch products');
      throw new HttpException(
        response.error || 'Failed to fetch products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.length },
      'Products fetched via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'Get product by ID',
    description:
      'Public endpoint. Fetches a single product by its MongoDB ObjectId.',
  })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { productId: id },
      'GET /products/:id — forwarding to Product Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { productId: id, error: response.error },
        'Product not found via gateway',
      );
      throw new HttpException(
        response.error || 'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }
}
