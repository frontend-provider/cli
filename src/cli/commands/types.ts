export class CommandResult {
  result: string;
  constructor(result: string) {
    this.result = result;
  }

  public toString(): string {
    return this.result;
  }

  public getDisplayResults() {
    return this.result;
  }
}

export abstract class TestCommandResult extends CommandResult {
  protected jsonResult = '';
  public getJsonResult(): string {
    return this.jsonResult;
  }

  public static createHumanReadableTestCommandResult(
    humanReadableResult: string,
    jsonResult: string,
  ): HumanReadableTestCommandResult {
    return new HumanReadableTestCommandResult(humanReadableResult, jsonResult);
  }

  public static createJsonTestCommandResult(
    jsonResult: string,
  ): JsonTestCommandResult {
    return new JsonTestCommandResult(jsonResult);
  }
}

class HumanReadableTestCommandResult extends TestCommandResult {
  protected jsonResult = '';

  constructor(humanReadableResult: string, jsonResult: string) {
    super(humanReadableResult);
    this.jsonResult = jsonResult;
  }

  public getJsonResult(): string {
    return this.jsonResult;
  }
}

class JsonTestCommandResult extends TestCommandResult {
  constructor(jsonResult: string) {
    super(jsonResult);
  }

  public getJsonResult(): string {
    return this.result;
  }
}
