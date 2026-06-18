import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { TEST_CASE_VALIDATION_TYPES } from '../../../db-schema/mongodb/schemas/test-case.schema';

type TestCaseValidationTarget = {
  validationType?: (typeof TEST_CASE_VALIDATION_TYPES)[number];
  expectedOutput?: unknown;
  expectedOutputCount?: number;
};

@ValidatorConstraint({ name: 'testCaseOutputRule', async: false })
export class TestCaseOutputRuleConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const testcase = args.object as TestCaseValidationTarget;
    const validationType =
      testcase.validationType ??
      (testcase.expectedOutputCount !== undefined &&
      testcase.expectedOutput === undefined
        ? 'count_only'
        : 'exact');

    if (validationType === 'count_only') {
      return (
        typeof testcase.expectedOutputCount === 'number' &&
        testcase.expectedOutputCount >= 0 &&
        testcase.expectedOutput === undefined
      );
    }

    return testcase.expectedOutput !== undefined;
  }

  defaultMessage(args: ValidationArguments) {
    const testcase = args.object as TestCaseValidationTarget;

    if (testcase.validationType === 'count_only') {
      return 'count_only testcases require expectedOutputCount (>= 0) and must not include expectedOutput';
    }

    return 'exact testcases require expectedOutput';
  }
}

export function IsValidTestCaseOutput(validationOptions?: ValidationOptions) {
  return function register(object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidTestCaseOutput',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: TestCaseOutputRuleConstraint,
    });
  };
}
