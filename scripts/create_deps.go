package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

var deps = []string{
	"@vue/language-server@latest",
	"@vue/typescript-plugin@latest",
	"typescript@latest",
}

func main() {
	pwd, _ := os.Getwd()
	if strings.HasSuffix(pwd, "/scripts") {
		fmt.Println("Please run this script from the root of the repository.")
		os.Exit(1)
	}

	_, err := os.Stat("dist")
	switch {
	case os.IsNotExist(err):
		fmt.Println("Please run `bun run build` first.")
		os.Exit(1)
	case err != nil:
		fmt.Println("Failed to check for dist folder:", err)
		os.Exit(1)
	}
	cleanup()

	pkgJson, err := os.Create("dist/package.json")
	if err != nil {
		fmt.Println("Failed to create package.json:", err)
		os.Exit(1)
	}

	_, err = pkgJson.WriteString("{}")
	if err != nil {
		defer pkgJson.Close()
		fmt.Println("Failed to write to package.json:", err)
		os.Exit(1)
	}
	pkgJson.Sync()
	pkgJson.Close()

	bunInstall := exec.Command("bun", "add")
	bunInstall.Args = append(bunInstall.Args, deps...)
	bunInstall.Stdout = os.Stdout
	bunInstall.Stderr = os.Stderr
	bunInstall.Dir = "./dist/"
	bunInstall.Env = os.Environ()

	err = bunInstall.Run()
	if err != nil {
		fmt.Println("Failed to run bun add:", err)
		os.Exit(1)
	}
	_, err = os.Stat("dist/node_modules")
	switch {
	case os.IsNotExist(err):
		cleanup()
		fmt.Println("Failed to install dependencies.")
		os.Exit(1)
	case err != nil:
		fmt.Println("Failed to check for node_modules folder:", err)
		os.Exit(1)
	}

	fmt.Println("Dependencies installed successfully.")
	err = os.Remove("dist/package.json")
	if err != nil {
		cleanup()
		fmt.Println("Failed to remove package.json:", err)
		os.Exit(1)
	}
	cleanupTransient()

}

func cleanupTransient() {
	_ = os.Remove("dist/bun.lock")
	_ = os.Remove("dist/yarn.lock")
	_ = os.Remove("dist/pnpm-lock.yaml")
	_ = os.Remove("dist/pnpm-lock.yml")
	_ = os.Remove("dist/pnpm-workspace.yaml")
	_ = os.Remove("dist/pnpm-workspace.yml")
	_ = os.Remove("dist/npm-shrinkwrap.json")
	_ = os.Remove("dist/bun.lockb")
	_ = os.Remove("dist/package-lock.json")
	_ = os.Remove("dist/package.json")

}

func cleanup() {
	_ = os.RemoveAll("dist/node_modules")
	cleanupTransient()

}
