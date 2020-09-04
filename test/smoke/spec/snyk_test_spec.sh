#shellcheck shell=sh

Describe "Snyk test command"
  Before snyk_login
  After snyk_logout

  Describe "npm test"
    run_test_in_subfolder() {
      cd ../fixtures/basic-npm || return
      snyk test
    }

    run_test_in_empty_subfolder() {
      cd ../fixtures/empty || return
      snyk test
    }

    It "throws error when file does not exist"
      When run snyk test --file=non-existent/package.json
      The status should equal 2
      The output should include "Could not find the specified file"
      The stderr should equal ""
    End

    It "throws error when no suppored manifests detected"
      When run run_test_in_empty_subfolder
      The status should equal 3
      The output should include "Could not detect supported target files in"
      The stderr should equal ""
    End

    It "finds vulns in a project in the same folder"
      When run run_test_in_subfolder
      The status should equal 1
      The output should include "https://snyk.io/vuln/npm:minimatch:20160620"
      The stderr should equal ""
    End

    It "finds vulns in a project when pointing to a folder"
      When run snyk test ../fixtures/basic-npm
      The status should be failure # issues found
      The output should include "https://snyk.io/vuln/npm:minimatch:20160620"
      The stderr should equal ""
    End

    It "finds vulns in a project when pointing to a file"
      When run snyk test --file=../fixtures/basic-npm/package.json
      The status should be failure # issues found
      The output should include "https://snyk.io/vuln/npm:minimatch:20160620"
      The stderr should equal ""
    End
  End

  Describe "npm test with JSON output"
    It "outputs a valid JSON with vulns"
      When run snyk test ../fixtures/basic-npm --json
      The status should be failure # issues found
      The output should include "npm:minimatch:20160620"
      The output should include '"vulnerabilities": ['
      The stderr should equal ""
      The result of function check_valid_json should be success
    End
  End

  Describe "npm test with JSON output and all-projects flag"
    snyk_test_json_all() {
      cd ../fixtures || return
      snyk test --json --all-projects
    }

    # https://github.com/snyk/snyk/pull/1324
    # Captures an issue with extra output in stderr when json flag was set and some project failed to test
    It "won't output to stderr when one project fails and json flag is set"
      When run snyk_test_json_all
      The status should be failure # issues found
      The stderr should equal ""
      The result of function check_valid_json should be success
    End
  End
End
