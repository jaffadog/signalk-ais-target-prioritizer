

    npm version patch   # major | minor | patch

This will update root package.json, commit the change and create the version git tag. 

Then push master & the tag to Github with 

    git push && git push --tags 

or 

    git push --follow-tags

and GH Actions will take care of the rest.


For prerelease/beta:

    npm version prerelease --preid=beta
    git push --follow-tags

or specify the version explicitly:

    npm version 1.19.0-beta.2
