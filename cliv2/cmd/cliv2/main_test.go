package main_test

import (
	"os"
	"strings"
	"testing"

	main "github.com/snyk/cli/cliv2/cmd/cliv2"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/stretchr/testify/assert"
)

func Test_MainWithErrorCode(t *testing.T) {
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 0)
}

func Test_MainWithErrorCode_no_cache(t *testing.T) {
	cacheDirectory := "MADE_UP_NAME"

	variables := main.EnvironmentVariables{
		CacheDirectory: cacheDirectory,
	}

	mainErr := main.MainWithErrorCode(variables, os.Args[1:])

	assert.Equal(t, mainErr, 0)
	assert.DirExists(t, cacheDirectory)

	os.RemoveAll(cacheDirectory)
}

func Test_GetConfiguration(t *testing.T) {
	cmd := "_bin/snyk_darwin_arm64 --debug --insecure test"
	args := strings.Split(cmd, " ")

	expectedConfig := main.EnvironmentVariables{
		Insecure:                     true,
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
	}
	expectedArgs := []string{"_bin/snyk_darwin_arm64", "--debug", "--insecure", "test"}

	actualConfig, actualArgs := main.GetConfiguration(args)

	assert.Equal(t, expectedArgs, actualArgs)
	assert.Equal(t, expectedConfig, actualConfig)
}

func Test_GetConfiguration02(t *testing.T) {
	cmd := "_bin/snyk_darwin_arm64 --debug --proxy-noauth --insecure test"
	args := strings.Split(cmd, " ")

	expectedConfig := main.EnvironmentVariables{
		Insecure:                     true,
		ProxyAuthenticationMechanism: httpauth.NoAuth,
	}
	expectedArgs := []string{"_bin/snyk_darwin_arm64", "--debug", "--insecure", "test"}

	actualConfig, actualArgs := main.GetConfiguration(args)

	assert.Equal(t, expectedArgs, actualArgs)
	assert.Equal(t, expectedConfig, actualConfig)
}
