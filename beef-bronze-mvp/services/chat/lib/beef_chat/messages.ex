defmodule BeefChat.Messages do
  @moduledoc """
  Chat messages in DynamoDB (Spec 03): partition key `thread_id`, sort key
  `sk` = "<ISO timestamp>#<message id>", so a thread reads back in time order.
  """
  alias BeefChat.Aws

  defp table, do: Application.fetch_env!(:beef_chat, :messages_table)

  def put(%{id: id, thread_id: tid, sender_id: sender, body: body, action: action, labels: labels, sent_at: at}) do
    Aws.dynamodb("PutItem", %{
      "TableName" => table(),
      "Item" => %{
        "thread_id" => %{"S" => tid},
        "sk" => %{"S" => "#{at}##{id}"},
        "id" => %{"S" => id},
        "sender_id" => %{"S" => sender},
        "body" => %{"S" => body},
        "action" => %{"S" => action},
        "labels" => %{"L" => Enum.map(labels, &%{"S" => &1})}
      }
    })
  end

  def recent(thread_id, limit \\ 50) do
    with {:ok, %{"Items" => items}} <-
           Aws.dynamodb("Query", %{
             "TableName" => table(),
             "KeyConditionExpression" => "thread_id = :t",
             "ExpressionAttributeValues" => %{":t" => %{"S" => thread_id}},
             "ScanIndexForward" => false,
             "Limit" => limit
           }) do
      {:ok, items |> Enum.map(&decode/1) |> Enum.reverse()}
    end
  end

  defp decode(item) do
    [sent_at | _] = String.split(item["sk"]["S"], "#")

    %{
      id: item["id"]["S"],
      thread_id: item["thread_id"]["S"],
      sender_id: item["sender_id"]["S"],
      body: item["body"]["S"],
      action: item["action"]["S"],
      labels: Enum.map(item["labels"]["L"] || [], & &1["S"]),
      sent_at: sent_at
    }
  end
end
