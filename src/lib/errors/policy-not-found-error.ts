import {CustomError} from './custom-error';

export class PolicyNotFoundError extends CustomError {
    private static ERROR_CODE: number = 404;
    private static ERROR_STRING_CODE: string = 'MISSING_DOTFILE';
    private static ERROR_MESSAGE: string =
        'Could not load policy. Try running `snyk wizard` to define a Snyk protect policy';

    constructor() {
        super(PolicyNotFoundError.ERROR_MESSAGE);
        this.code = PolicyNotFoundError.ERROR_CODE;
        this.strCode = PolicyNotFoundError.ERROR_STRING_CODE;
        this.userMessage = PolicyNotFoundError.ERROR_MESSAGE;
    }
}
