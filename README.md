# po-npr
push only;no pull request - agent version control for next level of AI


Agents 之间的文件变更协同，应该比 git 更直接、更简单：

1. 有变更，插入变更队列，可携带信息：
    - 变更的文件（git commit）
    - 此次变更对应的 agent loop 对话
2. 先进先出从队列中获得变更
3. 用新变更的 agent loop 对话与主分支对比
4. po-npr agent 自动根据场景进行代码 conflict 的解决
5. 解决后push，并记录这次变更请求的文件外的agent loop对话
