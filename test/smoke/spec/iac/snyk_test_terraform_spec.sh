#shellcheck shell=sh

Describe "Snyk iac test command"
  Before snyk_login
  After snyk_logout

  Describe "terraform single file scan"
    It "finds issues in terraform file"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf
      The status should be failure # issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."
      # Outputs issues   
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Security Group allows open ingress [Medium Severity] [SNYK-CC-TF-1] in Security Group"
      The output should include "introduced by resource > aws_security_group[allow_ssh] > ingress"

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Terraform"
      The output should include "Target file:       ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Project name:      terraform"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Tested ../fixtures/iac/terraform/sg_open_ssh.tf for known issues, found"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --severity-threshold=high
      The status should be success # no issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."
      # Outputs issues   
      The output should include "Infrastructure as code issues:"

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Terraform"
      The output should include "Target file:       ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Project name:      terraform"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Tested ../fixtures/iac/terraform/sg_open_ssh.tf for known issues, found"
    End

    It "outputs an error for invalid hcl2 tf files"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh_invalid_hcl2.tf
      The status should be failure
      The output should include "Illegal Terraform target file sg_open_ssh_invalid_hcl2.tf "
      The output should include "Validation Error Reason: Invalid HCL2 Format."
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --sarif
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"ruleId": "SNYK-CC-TF-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --json
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"packageManager": "terraformconfig",'
      The result of function check_valid_json should be success
    End
  End
End
