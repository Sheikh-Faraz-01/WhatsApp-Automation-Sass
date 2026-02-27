import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';

@Injectable()
export class WorkspaceService {
    constructor(
        @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    ) { }

    async findByPhoneNumberId(phoneNumberId: string): Promise<WorkspaceDocument | null> {
        return this.workspaceModel.findOne({ phoneNumberId }).exec();
    }
}
