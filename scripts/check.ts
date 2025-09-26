import {$} from 'bun';


const args = process.argv.slice(2)


const path = args[0]


const main = async () => {

    try {
await $`bunx --bun tsgo --noEmit --pretty false -p ./tsconfig.json`
    
    } catch (e) {
        if (e instanceof $.ShellError) {
            console.error(e.stderr)
            process.exit(1)
        }
        console.error(e)
    }

    try {
        await $`bunx --bun oxlint ${path}`
    } catch (e) {
        if (e instanceof $.ShellError) {
        console.error(e.stderr)
        process.exit(1)
        }
        console.error(e)
    }


}
export default main()