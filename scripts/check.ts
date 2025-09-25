import {$} from 'bun';


const args = process.argv.slice(2)

if (args.length !== 1) {
    console.error('Usage: bun run check <path>')
    process.exit(1)
}

const path = args[0]


const main = async () => {

if (path.startsWith('/')) {
    console.error('Path must be relative')
    process.exit(1)
}

    try {
    await $`bunx --bun tsgo --noEmit ${path}`
    
    } catch (e) {
        if (e instanceof $.ShellError) {
            console.error(e.stderr)
            process.exit(1)
        }
        throw e
    }

    try {
        await $`bunx --bun oxlint ${path}`
    } catch (e) {
        console.error(e.message)
        process.exit(1)
    }


}
export default main()