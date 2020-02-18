import { Application, Octokit } from 'probot'
import issueParser from 'issue-parser'

const parse = issueParser('github', {
	actions: { blockedBy: ['blocked by'], blocking: ['blocking'] },
})

const EVENTS = [
	'issues.opened',
	'issues.edited',
	'issues.closed',
	'issues.reopened',
]

export = (app: Application) => {
	app.log('App started.')

	app.on(EVENTS, async ctx => {
		const { issue } = ctx.payload
		const parsed = parse(issue.body)
		const { blocking, blockedBy } = parsed.actions

		const getIssue = async (n: number) => {
			const res = await ctx.github.issues.get({
				owner: ctx.payload.repository.owner.login,
				repo: ctx.payload.repository.name,
				issue_number: n,
			})

			return res.data
		}

		const addLabel = (issue_number: number, l: string) => {
			ctx.log(`Adding label ${l} to #${ctx.payload.issue.number}.`)
			ctx.github.issues.addLabels({
				owner: ctx.payload.repository.owner.login,
				repo: ctx.payload.repository.name,
				issue_number,
				labels: [l],
			})
		}
		const rmLabel = (issue_number: number, l: string) => {
			ctx.log(`Removing label ${l} to #${ctx.payload.issue.number}.`)
			ctx.github.issues.removeLabel({
				owner: ctx.payload.repository.owner.login,
				repo: ctx.payload.repository.name,
				issue_number,
				name: l,
			})
		}

		const labels = ctx.payload.issue.labels.map(l => l.name)

		//
		// Blocking
		//

		if (blocking.length > 0 && !labels.includes('blocking')) {
			addLabel(ctx.payload.issue.number, 'blocking')
		}
		if (blocking.length === 0 && labels.includes('blocking')) {
			rmLabel(ctx.payload.issue.number, 'blocking')
		}

		// others

		blocking.forEach(async a => {
			const i = await getIssue(Number(a.issue))
			const ls = i.labels.map(l => l.name)
			const { blockedBy } = parse(i.body).actions

			// Label
			if (!ls.includes('blocked')) {
				addLabel(i.number, 'blocked')
			}

			// If the blocked issue doesn't reference this issue
			if (
				!blockedBy.find(a => Number(a.issue) === Number(issue.number))
			) {
				ctx.github.issues.update({
					owner: ctx.payload.repository.owner.login,
					repo: ctx.payload.repository.name,
					issue_number: i.number,
					body: i.body + '\n\nBlocked by #' + issue.number,
				})
			}
		})

		//
		// Blocked by
		//

		if (blockedBy.length > 0 && !labels.includes('blocked')) {
			addLabel(ctx.payload.issue.number, 'blocked')
		}
		if (blockedBy.length === 0 && labels.includes('blocked')) {
			rmLabel(ctx.payload.issue.number, 'blocked')
		}

		ctx.log({ blocking, blockedBy })
	})
}
