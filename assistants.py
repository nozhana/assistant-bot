from dotenv import load_dotenv
from openai import OpenAI
import datetime

load_dotenv()

# Initialize the OpenAI client
client = OpenAI()


def upload_file():
    filename = input("Enter the filename to upload: ")
    try:
        with open(filename, "rb") as file:
            response = client.files.create(file=file, purpose="assistants")
            print(response)
            print(f"File uploaded successfully: {response.filename} [{response.id}]")
    except FileNotFoundError:
        print("File not found. Please make sure the filename and path are correct.")


def list_files():
    response = client.files.list(purpose="assistants")
    if len(response.data) == 0:
        print("No files found.")
        return
    for file in response.data:
        created_date = datetime.datetime.utcfromtimestamp(file.created_at).strftime(
            "%Y-%m-%d"
        )
        print(f"{file.filename} [{file.id}], Created: {created_date}")


def list_and_delete_file():
    while True:
        response = client.files.list(purpose="assistants")
        files = list(response.data)
        if len(files) == 0:
            print("No files found.")
            return
        for i, file in enumerate(files, start=1):
            created_date = datetime.datetime.utcfromtimestamp(file.created_at).strftime(
                "%Y-%m-%d"
            )
            print(f"[{i}] {file.filename} [{file.id}], Created: {created_date}")
        choice = input(
            "Enter a file number to delete, or any other input to return to menu: "
        )
        if not choice.isdigit() or int(choice) < 1 or int(choice) > len(files):
            return
        selected_file = files[int(choice) - 1]
        client.files.delete(selected_file.id)
        print(f"File deleted: {selected_file.filename}")


def delete_all_files():
    confirmation = input(
        "This will delete all OpenAI files with purpose 'assistants'.\n Type 'YES' to confirm: "
    )
    if confirmation == "YES":
        response = client.files.list(purpose="assistants")
        for file in response.data:
            client.files.delete(file.id)
        print("All files with purpose 'assistants' have been deleted.")
    else:
        print("Operation cancelled.")


def list_all_assistants():
    response = client.beta.assistants.list()
    if len(response.data) == 0:
        print("No assistants found.")
        return

    for i, assistant in enumerate(response.data, start=1):
        created_date = datetime.datetime.utcfromtimestamp(
            assistant.created_at
        ).strftime("%Y-%m-%d")
        print(
            f"[{i}] {assistant.name} [{assistant.id}], Created: {created_date}\nInstructions: {assistant.instructions }"
        )

    return list(response.data)


def list_and_delete_assistants():
    assistants = list_all_assistants()
    choice = input("Enter a number to delete, or enter anything else to go back. > ")
    if not choice.isdigit() or int(choice) < 1 or int(choice) > len(assistants):
        return
    assistant = assistants[int(choice) - 1]
    client.beta.assistants.delete(assistant.id)
    print(f"Deleted assistant: {assistant.name}")


def main():
    while True:
        print("\n== Assistants file utility ==")
        print("[1] Upload file")
        print("[2] List all files")
        print("[3] List all files and delete one")
        print("[4] Delete all assistant files (confirmation required)")
        print("[5] List all assistants")
        print("[6] List all assistants and delete one")
        print("[0] Exit")
        choice = input("Enter your choice: ")

        if choice == "1":
            upload_file()
        elif choice == "2":
            list_files()
        elif choice == "3":
            list_and_delete_file()
        elif choice == "4":
            delete_all_files()
        elif choice == "5":
            list_all_assistants()
        elif choice == "6":
            list_and_delete_assistants()
        elif choice == "0":
            break
        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()
