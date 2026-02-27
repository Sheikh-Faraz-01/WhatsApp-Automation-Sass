import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WebhookService } from './webhook.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { Message } from './schemas/message.schema';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { ConfigService } from '@nestjs/config';

describe('WebhookService', () => {
    let service: WebhookService;
    let workspaceService: WorkspaceService;
    let rabbitClient: any;
    let messageModel: any;
    let configService: ConfigService;

    const payload = {
        entry: [{
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '15550101234',
                        phone_number_id: '12345'
                    },
                    messages: [{
                        from: '1234567890',
                        id: 'wamid.HBgLMTIzNDU2Nzg5MBUSWzE=',
                        timestamp: '1708850000',
                        text: { body: 'Hello!' },
                        type: 'text'
                    }]
                }
            }]
        }]
    };

    const mockMessageModel = function (dto: any) {
        Object.assign(this, dto);
        this.save = jest.fn().mockResolvedValue(this);
    };
    mockMessageModel.updateOne = jest.fn();

    const mockRabbitClient = {
        emit: jest.fn().mockReturnValue(of({})),
    };

    const mockWorkspaceService = {
        findByPhoneNumberId: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn().mockReturnValue('test_secret'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookService,
                {
                    provide: getModelToken(Message.name),
                    useValue: mockMessageModel,
                },
                {
                    provide: 'RABBITMQ_SERVICE',
                    useValue: mockRabbitClient,
                },
                {
                    provide: WorkspaceService,
                    useValue: mockWorkspaceService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<WebhookService>(WebhookService);
        workspaceService = module.get<WorkspaceService>(WorkspaceService);
        rabbitClient = module.get('RABBITMQ_SERVICE');
        messageModel = module.get(getModelToken(Message.name));
        configService = module.get<ConfigService>(ConfigService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processMessage', () => {
        it('should ignore non-WhatsApp event (missing phone_number_id)', async () => {
            const result: any = await service.processMessage({});
            expect(result.success).toBe(true);
            expect(result.message).toBe('Ignored');
        });

        it('should throw error if workspace is not found', async () => {
            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue(null);
            await expect(service.processMessage(payload)).rejects.toThrow(HttpException);
        });

        it('should save structured message and emit event if workspace exists', async () => {
            const workspaceId = '65d1234567890abcdef12345';
            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue({
                _id: workspaceId,
                phoneNumberId: '12345'
            });

            const result: any = await service.processMessage(payload);

            expect(result.success).toBe(true);
            expect(result.workspaceId).toBe(workspaceId);
            expect(result.waMessageId).toBe('wamid.HBgLMTIzNDU2Nzg5MBUSWzE=');
            expect(rabbitClient.emit).toHaveBeenCalled();
        });

        it('should handle status updates correctly', async () => {
            const statusPayload = {
                entry: [{
                    changes: [{
                        value: {
                            metadata: { phone_number_id: '12345' },
                            statuses: [{
                                id: 'wamid.HBgLMTIzNDU2Nzg5MBUSWzE=',
                                status: 'delivered',
                                timestamp: '1708850000'
                            }]
                        }
                    }]
                }]
            };

            const workspaceId = '65d1234567890abcdef12345';
            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue({
                _id: workspaceId,
                phoneNumberId: '12345'
            });

            mockMessageModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result: any = await service.processMessage(statusPayload);

            expect(result.success).toBe(true);
            expect(result.status).toBe('delivered');
            expect(mockMessageModel.updateOne).toHaveBeenCalled();
        });

        it('should handle interactive button replies', async () => {
            const interactivePayload = {
                entry: [{
                    changes: [{
                        value: {
                            metadata: { phone_number_id: '12345' },
                            messages: [{
                                from: '1234567890',
                                id: 'wamid.interactive',
                                timestamp: '1708850000',
                                type: 'interactive',
                                interactive: {
                                    type: 'button_reply',
                                    button_reply: { id: 'yes', title: 'Yes' }
                                }
                            }]
                        }
                    }]
                }]
            };

            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue({
                _id: '65d1234567890abcdef12345',
                phoneNumberId: '12345'
            });

            const result: any = await service.processMessage(interactivePayload);

            expect(result.success).toBe(true);
            expect(result.waMessageId).toBe('wamid.interactive');
        });

        it('should return successfully and ignore if no actionable content', async () => {
            const emptyPayload = {
                entry: [{
                    changes: [{
                        value: {
                            metadata: { phone_number_id: '12345' }
                        }
                    }]
                }]
            };

            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue({
                _id: '65d1234567890abcdef12345',
                phoneNumberId: '12345'
            });

            const result: any = await service.processMessage(emptyPayload);
            expect(result.success).toBe(true);
            expect(result.message).toBe('No actionable content');
        });

        it('should handle RabbitMQ failure gracefully', async () => {
            mockWorkspaceService.findByPhoneNumberId.mockResolvedValue({
                _id: '65d1234567890abcdef12345',
                phoneNumberId: '12345'
            });

            mockRabbitClient.emit.mockReturnValue(of(throwError(() => new Error('RabbitMQ Error'))));

            const result: any = await service.processMessage(payload);

            expect(result.success).toBe(true);
            expect(result.waMessageId).toBeDefined();
        });
    });
});
