import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  USER_IMAGE_MODEL,
  UserImage,
  UserImageDocument,
} from '../../../../../db-schema/mongodb/schemas/user-image.schema';

@Injectable()
export class UserImageRepository {
  constructor(
    @InjectModel(USER_IMAGE_MODEL)
    private readonly model: Model<UserImageDocument>,
  ) {}

  create(data: Partial<UserImage>) {
    return this.model.create(data);
  }

  findByIdForUser(id: string, userId: string) {
    return this.model.findOne({ _id: id, userId }).exec();
  }

  findManyForUser(
    userId: string,
    opts: { type?: string; skip: number; take: number },
  ) {
    const filter: Record<string, string> = { userId };
    if (opts.type) {
      filter.type = opts.type;
    }
    return Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.take)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }

  deleteByIdForUser(id: string, userId: string) {
    return this.model.findOneAndDelete({ _id: id, userId }).exec();
  }
}
