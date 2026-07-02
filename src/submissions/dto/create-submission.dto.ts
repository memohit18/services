import { IsNotEmpty, IsString } from 'class-validator';

/** Submit only requires code — the server judges against all test cases. */
export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
