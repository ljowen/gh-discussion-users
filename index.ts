import { GraphQLClient } from 'graphql-request'
import { readFileSync, writeFileSync } from 'fs';
import path  from 'path';

/* Provide personal access token */
const tok = readFileSync(path.resolve(__dirname, 'tok.txt'), 'utf8')
const endpoint = `https://api.github.com/graphql`;

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    authorization: `Bearer ${tok}`,
  },
})

const query = (nextCursor = null) => `
query {
    repository(owner: "TerriaJS", name: "terriajs") {
        
      discussions(first: 100, after: ${nextCursor ? `"${nextCursor}"` : null} ) {
        # type: DiscussionConnection
        totalCount # Int!
  
        pageInfo {
          # type: PageInfo (from the public schema)
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
        }
  
        nodes {
          # type: Discussion
          id
          author {
              login,                  
          }
          comments(first: 100)  {
              nodes {
                  author {
                      login
                  }
              }
  
          }
        }
      }
    }
  }
`;

const userQuery = (login: string) => `query {
    user(login: "${login}") {
      id,
      name,
      email,
          organization(login:"${login}") {  
          name,
      email
}
      organizations(first: 5) {
    nodes{        
      name,
      email
    }
     pageInfo {
      hasNextPage
    }
  }  
}             
}
`;


(async function main() {
    let hasNextPage = true;
    let nextCursor = null;    
    const users = new Set();
    /* Fetch unique authors from all discussion posts and comments */
    while(hasNextPage === true) {
        const data: any = await graphQLClient.request<any>(query(nextCursor))        
        hasNextPage = data.repository.discussions.pageInfo.hasNextPage || false;
        nextCursor = data.repository.discussions.pageInfo.endCursor;        
        data.repository.discussions.nodes.forEach((d: any) => { 
            users.add(d.author.login);
            d.comments.nodes.forEach((c: any) => { 
                users.add(c.author.login)
            })
        })          
    }        
    /* Get email and orgs of all users */        
    const userData = await Promise.all(Array.from(users.keys()).map(async login => {
        return await graphQLClient.request<any>(userQuery(login as string));           
    }));    
    writeFileSync('./users.json', JSON.stringify(userData, null, 2));
})();

